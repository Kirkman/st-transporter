load("sbbsdefs.js");
load("frame.js");
load("sprite.js");
load(js.exec_dir + "frame-transitions.js");
// load(js.exec_dir + "helper-functions.js");

// GLOBAL FRAME VARIABLES
var bgFrame, bgFrame1, fgFrame, santaSpriteFrame, transporterEffectFrame, msgFrame;
var bgFrameArray = [];
var canvasFrame;
var screenShot = false;
var ss = 0;

// ANIMATION CODES
var delayHalfSec = ';';
var delayTwoSecs = '.';

// BLOCK CODES
var blockSolid = ascii(219);
var blockHalfBottom = ascii(220);
var blockHalfTop = ascii(223);
var blockGradient1 = ascii(176);
var blockGradient2 = ascii(177);
var blockGradient3 = ascii(178);


// COLOR MASKING CODES
var BG_MASK = 0x70;
var FG_MASK = 0x07;
// HIGH and BLINK are already defined in sbbsdefs.js


// COLOR CODES
var lowWhite = 'NW0';
var highWhite = 'HW0';
var lowCyan = 'NC0';
var highCyan = 'HC0';
var highBlack = 'HK0';
var highYellowDarkBlue = 'HY4';
var highWhiteDarkCyan = 'HW6';


function getRandomInt(min, max) {
	min = Math.ceil(min);
	max = Math.floor(max);
	return Math.floor(Math.random() * (max - min)) + min; //The maximum is exclusive and the minimum is inclusive
}

function getDominantColor( theChar, theAttr ) {
	var color = null;
	// Use bitwise AND with a mask to get the four rightmost bits.
	// dec 15  |  bin 00001111  |  hex 0xf
	// var fg = theAttr & 15;
	var fg = theAttr & (FG_MASK | HIGH);

	// Use bitwise AND with a mask to get the four leftmost bits.
	// dec 240 |  bin 11110000  |  hex 0xf0
	//var bg = theAttr & 240;
	var bg = theAttr & BG_MASK; // exclude the blink flag

	// If it's a solid block, or a nearly-solid gradient, return the foreground color.
	// However, if the foreground color is high, we need to return low.
	if ( theChar == blockSolid || theChar == blockGradient3 ) {
		// convert fg color to bg color; using mask to also convert high to low
		return (fg & FG_MASK)<<4;
	}
	// In cases of half-blocks that contain black, return the non-black color.
	else if ( theChar == blockHalfBottom || theChar == blockHalfTop ) {
		if ( fg == BG_BLACK || fg == BLACK ) {
			return bg;
		}
		else {
			// convert fg color to bg color; using mask to also convert high to low
			return (fg & FG_MASK)<<4;
		}
	}

	// Otherwise, just use the background color.
	else {
		return bg;
	}
}



// Compare a canvas frame against data in another frame. Repaint characters that are different.
function repaintCanvas( newFrame, canvas ) {
	var newFrameData = newFrame.dump();
	for (var x=0; x<canvas.width; x++) {
		for (var y=0; y<canvas.height; y++) {
			var newChar = newFrameData[y][x];
			var oldChar = canvas.getData(x,y);
			// Compare corresponding characters on current canvas and the new frame.
			// If they are different, repaint the character on the canvas.
			if ( newChar && (newChar.attr !== oldChar.attr || newChar.ch !== oldChar.ch) ) {
				canvas.clearData(x,y);
				canvas.setData(x,y,newChar.ch,newChar.attr);
			}
			// If the new frame has a null instead of a character object,
			// treat that like an empty black space. Draw it on the canvas
			// if the corresponding character is not also an empty black space.
			else if ( newChar == null ) {
				if ( oldChar.ch != ascii(32) || oldChar.attr != BG_BLACK ) {
					canvas.clearData(x,y);
					canvas.setData(x,y,ascii(32),BG_BLACK);
				}
			}
		}
	}
}




function makeBg() {

	// SET UP THE FRAMES
	// --------------------------------------------------------

	// Parent frame for all the background frames and sprite frames
	bgFrame = new Frame(1, 1, 80, 24, BG_BLACK);

	// This allows me to hold frames "offstage" beyond the bounds of bgFrame
	bgFrame.checkbounds = false;

	bgFrame1 = new Frame(1, 1, 80, 24, BG_BLACK, bgFrame);
	bgFrame1.load(js.exec_dir + '/graphics/transporter-room.bin');


	fgFrame = new Frame(1, 1, 80, 24, undefined, bgFrame);
	maskFrame( fgFrame, ascii(23), BG_BLACK );
	maskFrame( fgFrame, ascii(219), BLACK );
	fgFrame.transparent = true;

	bgFrameArray = [
		bgFrame1,
		fgFrame
	];



	santaSpriteFrame  = new Frame(14, 1, 28, 21, undefined, bgFrame);
	santaSpriteFrame.load(js.exec_dir + '/graphics/santa.bin');
	// move the sprite down 1 pixel within the frame. want this frame the same size as the transportereffectframe.
	maskFrame( santaSpriteFrame, ascii(219), CYAN );
	santaSpriteFrame.transparent = true;


	sackSpriteFrame  = new Frame(40, 1, 28, 21, undefined, bgFrame);
	sackSpriteFrame.load(js.exec_dir + '/graphics/sack.bin');
	// move the sprite down 1 pixel within the frame. want this frame the same size as the transportereffectframe.
	maskFrame( sackSpriteFrame, ascii(219), CYAN );
	sackSpriteFrame.transparent = true;


	transporterPadFrame  = new Frame(23, 20, 14, 3, undefined, bgFrame);


	transporterEffectFrame  = new Frame(14, 1, 28, 21, undefined, bgFrame);
	maskFrame( transporterEffectFrame, ascii(23), BG_BLACK );
	maskFrame( transporterEffectFrame, ascii(219), BLACK );
	transporterEffectFrame.transparent = true;


	msgFrame = new Frame(1,1,38,5,BG_LIGHTGRAY|WHITE,bgFrame);
	msgFrame.load(js.exec_dir + '/graphics/bubble2.bin');


	// Open all background layers
	for (var b=0; b<bgFrameArray.length; b++) {
		bgFrameArray[b].open();
	}

	//santaSpriteFrame.open();




}


function checkRays(rays) {
	var running = false;
	for (var r=0; r<rays.length; r++) {
		if ( rays[r]['current'] < rays[r]['end'] ) {
			running = true;
		}
	}
	return running;
}



function transport( spriteFrame, beamFrame ) {
	var tw = beamFrame.width;
	var th = beamFrame.height;
	var fx = beamFrame.x;
	var fy = beamFrame.y;

	// Transporter Beam Rays
	var rays = [];
	// Set up an array of "rays". These contain a starting position, a direction, and an end y-coordinate.
	for (var i=0; i<=tw; i++) {
		rays.push(
			{
				'x': i,
				'y': 0,
				'length': getRandomInt(2, 18),
				'current': 0,
				'end': th-1,
			}
		);
	}

	// Randomize the rays
	rays.sort( function (a, b) { return Math.random() - 0.5; } );

	var spritePixels = {};
	// Add an array of pixels to track if one of the pixels in the sprite have been touch by a ray.
	for (var tx=0; tx<tw; tx++) {
		for (var ty=0; ty<th; ty++) {
			var key = tx+'-'+ty;
			spritePixels[key] = false;
		}
	}

	// Write code here to begin drawing the rays. Need to use various gradients. Maybe change color too for sparkles?
	// Each ray should begin with gradient1, then progress thru 2 gradients. 


	emptyFrame( beamFrame );
	beamFrame.open();

	var running = true;

	while ( running ) {
		var iteration = 0;
		for (var r=0; r<rays.length; r++) {
			// Get the length of the ray. Anything from 1-12 pixels
			var rlen = rays[r]['length'];
			// Generate a random amount from 1-3 pixels for the ray to move downward.
			var moveAmt = getRandomInt(1, 3);
			// Make sure the moveAmt is not greater than the length of the ray, or we'll leave gaps.
			if (moveAmt > rlen) { moveAmt = rlen; }
			// Get x and y coordinates for the head of the ray
			var rx = rays[r]['x'];
			var ry = rays[r]['y'] + moveAmt;
			//gradients.sort( function (a, b) { return Math.random() - 0.5; } );

			// Iterate over all pixels in this ray's column for cleanup
			for (var si=0; si<beamFrame.height; si++) {
				// Clear previous data for this pixel
				beamFrame.clearData( rx, si );
				// Check if this pixel has been "activated": That is, it contains part of the Santa sprite and has been touched by a ray.
				// Using keys, since they make the lookup much faster
				var key = rx + '-' + si;
				thisPixelIsActivated = spritePixels[key];
				// If this pixel is activated, then we need to set it to solid white or yellow to create the "flicker"
				if (thisPixelIsActivated) {
					var colors = [WHITE,WHITE,WHITE,WHITE,YELLOW];
					colors.sort( function (a, b) { return Math.random() - 0.5; } );
					beamFrame.setData( rx, si, blockSolid, colors[0] );
				}
				// Otherwise, leave the pixel transparent
				else {
					beamFrame.setData( rx, si, undefined, undefined );
				}
			}
			// Draw new pixels for the ray
			for (var ri=0; ri<rlen; ri++) {
				// Get the equivalent pixel from the SantaSprite.
				var spritePixel = spriteFrame.getData(rx, ry-ri);
				// Check if the santa sprite's pixel is NOT transparent.
				if (spritePixel.ch !== undefined) {
					// If the santa sprite pixel is NOT transparent, then let's "activate" this pixel since the ray is touching it.
					var key = rx + '-' + (ry-ri);
					spritePixels[key] = true;
				}
				// Next, we need to get the background color info. 
				// To do that, first we get the equivalent pixel from the bgFrame.
				var scenePixel = bgFrame1.getData(fx+rx, fy+ry-ri);
				// use getDominantColor to generate a background color from this pixel
				var bg_color = getDominantColor( scenePixel.ch, scenePixel.attr );
				// use the lightest gradient for the trailing pixels of the ray
				var gradient = blockGradient1;
				// Use the second-lightest gradient for the lead pixel of the ray
				if (ri==0) { gradient = blockGradient2; }
				// Draw the ray pixel into the TransporterEffectFrame
				beamFrame.setData( rx, ry-ri, gradient, WHITE|bg_color );
			}
			// Update ray's tail position
			rays[r]['current'] = ry-rlen;
			// Update ray's head position
			rays[r]['y'] = ry;
			// Draw the updated TransporterEffectFrame
			beamFrame.cycle();
			if (screenShot) {
				// We're counting iterations to ensure we generate fewer screenshots.
				if (iteration % 20 == 0) {
					var ssStr = ss.toString().rjust(4,'0');
					bgFrame.screenShot(js.exec_dir + "/screenshots/transporter-" + ssStr + ".bin", false);
					ss++;
				}
			}
			for (var pauser=0; pauser<1; pauser++) {
				console.putmsg('\033[1C\033[1D', mode=P_NOPAUSE );
				mswait(1);
			}
			iteration++;
		}
		// This loop will ceases once all the rays' tails have passed the "end" position, 
		// (that is, once the rays have disappeared from the bottom of the scene)
		running = checkRays(rays);
	}


	// Continue the sparkly effect
	for (var i=0; i<3; i++) {
		for (var tx=0; tx<tw; tx++) {
			for (var ty=0; ty<th; ty++) {
				// Clear previous data for this pixel
				beamFrame.clearData( tx, ty );
				// Check if this pixel has been "activated": That is, it contains part of the Santa sprite and has been touched by a ray.
				// Using keys, since they make the lookup much faster
				var key = tx + '-' + ty;
				thisPixelIsActivated = spritePixels[key];
				// If this pixel is activated, then we need to set it to solid white or yellow to create the "flicker"
				if (thisPixelIsActivated) {
					var colors = [WHITE,WHITE,WHITE,WHITE,YELLOW];
					colors.sort( function (a, b) { return Math.random() - 0.5; } );
					beamFrame.setData( tx, ty, blockSolid, colors[0] );
				}
				// Otherwise, leave the pixel transparent
				else {
					beamFrame.setData( tx, ty, undefined, undefined );
				}
			}
			// Draw the updated TransporterEffectFrame
			beamFrame.cycle();
			for (var pauser=0; pauser<1; pauser++) {
				console.putmsg('\033[1C\033[1D', mode=P_NOPAUSE );
				mswait(1);
			}
		}
		if (screenShot) {
			var ssStr = ss.toString().rjust(4,'0');
			bgFrame.screenShot(js.exec_dir + "/screenshots/transporter-" + ssStr + ".bin", false);
			ss++;
		}
	}



	// !!!!!!!!!
	//
	// MATERIALIZING
	// Create three arrays. First one contains all pixels, second and third are empty.
	// Gradually transfer pixels from one to the next to the last.
	// Each array signifies what gradient character to use.
	//
	// !!!!!!!!!


	var binOne = [];
	var binTwo = [];
	var binThree = [];
	var binFour = [];

	for (var tx=0; tx<tw; tx++) {
		for (var ty=0; ty<th; ty++) {
			var spritePixel = spriteFrame.getData( tx, ty );
			if ( spritePixel.ch !== undefined && spritePixel.attr !== undefined  ) {
				binOne.push(tx + '-' + ty);
			}
		}
	}


	while (binOne.length > 5 || binThree.length > 5) {
		for (var tx=0; tx<tw; tx++) {
			for (var ty=0; ty<th; ty++) {
				var colors = [WHITE,WHITE,WHITE,WHITE,YELLOW];
				colors.sort( function (a, b) { return Math.random() - 0.5; } );
				thisPixel = beamFrame.getData( tx, ty );
				binOneIdx = binOne.indexOf(tx + '-' + ty);
				binTwoIdx = binTwo.indexOf(tx + '-' + ty);
				binThreeIdx = binThree.indexOf(tx + '-' + ty);
				binFourIdx = binFour.indexOf(tx + '-' + ty);
				var spritePixel = spriteFrame.getData( tx, ty );
				var bg_color = getDominantColor( spritePixel.ch, spritePixel.attr );

				if ( thisPixel.ch == blockSolid && binOneIdx > -1 ) {
					if ( Math.random() > 0.9) {
						beamFrame.clearData( tx, ty );
						beamFrame.setData( tx, ty, blockGradient3, colors[0]|bg_color );
						binOne.splice(binOneIdx,1);
						binTwo.push(tx + '-' + ty);
					}
				}
				else if ( thisPixel.ch == blockGradient3 && binTwoIdx > -1 ) {
					if ( Math.random() > 0.5) {
						beamFrame.clearData( tx, ty );
						beamFrame.setData( tx, ty, blockGradient2, colors[0]|bg_color );
						binTwo.splice(binTwoIdx,1);
						binThree.push(tx + '-' + ty);
					}
				}
				else if ( thisPixel.ch == blockGradient2 && binThreeIdx > -1 ) {
					if ( Math.random() > 0.3) {
						beamFrame.clearData( tx, ty );
						beamFrame.setData( tx, ty, blockGradient1, colors[0]|bg_color );
						binThree.splice(binThreeIdx,1);
						binFour.push(tx + '-' + ty);
					}
				}
				else if ( thisPixel.ch == blockGradient1 && binFourIdx > -1 ) {
					if ( Math.random() > 0.1) {
						beamFrame.clearData( tx, ty );
						beamFrame.setData( tx, ty, spritePixel.ch, spritePixel.attr );
					}
				}

			}
		}	
		// Draw the updated TransporterEffectFrame
		beamFrame.cycle();
		if (screenShot) {
			var ssStr = ss.toString().rjust(4,'0');
			bgFrame.screenShot(js.exec_dir + "/screenshots/transporter-" + ssStr + ".bin", false);
			ss++;
		}
		for (var pauser=0; pauser<3; pauser++) {
			console.putmsg('\033[1C\033[1D', mode=P_NOPAUSE );
			mswait(4);
		}
	}	
}


function play() {
 	var xl = bgFrame.width;
 	var yl = bgFrame.height;
	// end credits screen
	var creditsFr = 0;
	var numCreditsFrames = 8;


	// ====================================================
	// TITLE SCREEN
	// ====================================================

	titleFrame = new Frame(1, 1, 80, 24, undefined, bgFrame);
	titleFrame.load(js.exec_dir + '/graphics/title.bin');
	titleFrame.open();
	titleFrame.cycle();
	if (screenShot) {
		var ssStr = ss.toString().rjust(4,'0');
		bgFrame.screenShot(js.exec_dir + "/screenshots/transporter-" + ssStr + ".bin", false);
		ss++;
	}
	for (var pauser=0; pauser<1000; pauser++) {
		console.putmsg('\033[1C\033[1D', mode=P_NOPAUSE );
		mswait(3);
	}
	titleFrame.close();
	titleFrame.cycle();
	if (screenShot) {
		var ssStr = ss.toString().rjust(4,'0');
		bgFrame.screenShot(js.exec_dir + "/screenshots/transporter-" + ssStr + ".bin", false);
		ss++;
	}

	for (var pauser=0; pauser<333; pauser++) {
		console.putmsg('\033[1C\033[1D', mode=P_NOPAUSE );
		mswait(3);
	}

	// ====================================================
	// ANIMATION
	// ====================================================

	msgFrame.gotoxy(0,2);
	msgFrame.center('[Intercom] Scotty, a vessel');
	msgFrame.crlf();
	msgFrame.center('is breaking up in the atmosphere.');
	msgFrame.crlf();
	msgFrame.center('Beam up the survivors!');
	msgFrame.open();
	msgFrame.cycle();

	if (screenShot) {
		var ssStr = ss.toString().rjust(4,'0');
		bgFrame.screenShot(js.exec_dir + "/screenshots/transporter-" + ssStr + ".bin", false);
		ss++;
	}
	for (var pauser=0; pauser<2000; pauser++) {
		console.putmsg('\033[1C\033[1D', mode=P_NOPAUSE );
		mswait(3);
	}

	msgFrame.load(js.exec_dir + '/graphics/bubble2.bin');
	msgFrame.moveTo(43,20);
	msgFrame.gotoxy(0,2);
	msgFrame.center('Aye, Captain.');
	msgFrame.crlf();
	msgFrame.center('I read one life form.');
	msgFrame.crlf();
	msgFrame.center('Transporting now!');
	msgFrame.cycle();

	if (screenShot) {
		var ssStr = ss.toString().rjust(4,'0');
		bgFrame.screenShot(js.exec_dir + "/screenshots/transporter-" + ssStr + ".bin", false);
		ss++;
	}
	for (var pauser=0; pauser<2000; pauser++) {
		console.putmsg('\033[1C\033[1D', mode=P_NOPAUSE );
		mswait(3);
	}
	msgFrame.close();

	// Light up the transporter pad
	transporterPadFrame.load(js.exec_dir + '/graphics/pad1.bin');
	transporterPadFrame.open();
	transporterPadFrame.cycle();

	if (screenShot) {
		var ssStr = ss.toString().rjust(4,'0');
		bgFrame.screenShot(js.exec_dir + "/screenshots/transporter-" + ssStr + ".bin", false);
		ss++;
	}
	for (var pauser=0; pauser<200; pauser++) {
		console.putmsg('\033[1C\033[1D', mode=P_NOPAUSE );
		mswait(3);
	}

	transport( santaSpriteFrame, transporterEffectFrame );


	transporterPadFrame.close();
	transporterEffectFrame.close();

	bgFrame.invalidate();
	santaSpriteFrame.open();
	santaSpriteFrame.top();
	santaSpriteFrame.cycle();

	if (screenShot) {
		var ssStr = ss.toString().rjust(4,'0');
		bgFrame.screenShot(js.exec_dir + "/screenshots/transporter-" + ssStr + ".bin", false);
		ss++;
	}

	msgFrame.load(js.exec_dir + '/graphics/bubble2.bin');
	msgFrame.moveTo(43,1);
	msgFrame.gotoxy(0,2);
	msgFrame.center('....Rudolph, stop!');
	msgFrame.crlf();
	msgFrame.center('Don\'t fly so high! ');
	msgFrame.crlf();
	msgFrame.center('It\'s dangerous!!!');
	msgFrame.open();
	msgFrame.cycle();

	if (screenShot) {
		var ssStr = ss.toString().rjust(4,'0');
		bgFrame.screenShot(js.exec_dir + "/screenshots/transporter-" + ssStr + ".bin", false);
		ss++;
	}
	for (var pauser=0; pauser<2000; pauser++) {
		console.putmsg('\033[1C\033[1D', mode=P_NOPAUSE );
		mswait(3);
	}


	msgFrame.load(js.exec_dir + '/graphics/bubble2.bin');
	msgFrame.moveTo(43,1);
	msgFrame.gotoxy(0,2);
	msgFrame.center('Wait, where am I?');
	msgFrame.crlf();
	msgFrame.center('HO, HO, HO....OOOOOLY SMOKES!');
	msgFrame.crlf();
	msgFrame.center('This is not my sleigh!');
	msgFrame.open();
	msgFrame.cycle();

	if (screenShot) {
		var ssStr = ss.toString().rjust(4,'0');
		bgFrame.screenShot(js.exec_dir + "/screenshots/transporter-" + ssStr + ".bin", false);
		ss++;
	}
	for (var pauser=0; pauser<2000; pauser++) {
		console.putmsg('\033[1C\033[1D', mode=P_NOPAUSE );
		mswait(3);
	}


	msgFrame.load(js.exec_dir + '/graphics/bubble2.bin');
	msgFrame.moveTo(43,20);
	msgFrame.gotoxy(0,2);
	msgFrame.center('I cannae believe my eyes!');
	msgFrame.crlf();
	msgFrame.center('SANTA CLAUS?!');
	msgFrame.crlf();
	msgFrame.center('Welcome to the USS Enterprise.');
	msgFrame.cycle();

	if (screenShot) {
		var ssStr = ss.toString().rjust(4,'0');
		bgFrame.screenShot(js.exec_dir + "/screenshots/transporter-" + ssStr + ".bin", false);
		ss++;
	}
	for (var pauser=0; pauser<2000; pauser++) {
		console.putmsg('\033[1C\033[1D', mode=P_NOPAUSE );
		mswait(3);
	}


	msgFrame.load(js.exec_dir + '/graphics/bubble2.bin');
	msgFrame.moveTo(43,1);
	msgFrame.gotoxy(0,2);
	msgFrame.center('Did you ... teleport me?');
	msgFrame.crlf();
	msgFrame.center('Amazing! But I lost Rudolph.');
	msgFrame.crlf();
	msgFrame.center('How will I finish?');
	msgFrame.open();
	msgFrame.cycle();

	if (screenShot) {
		var ssStr = ss.toString().rjust(4,'0');
		bgFrame.screenShot(js.exec_dir + "/screenshots/transporter-" + ssStr + ".bin", false);
		ss++;
	}
	for (var pauser=0; pauser<2000; pauser++) {
		console.putmsg('\033[1C\033[1D', mode=P_NOPAUSE );
		mswait(3);
	}


	msgFrame.load(js.exec_dir + '/graphics/bubble2.bin');
	msgFrame.moveTo(43,20);
	msgFrame.gotoxy(0,2);
	msgFrame.center('Dinnae worry, Santa. ');
	msgFrame.crlf();
	msgFrame.center('I can transport you anywhere.');
	msgFrame.cycle();

	if (screenShot) {
		var ssStr = ss.toString().rjust(4,'0');
		bgFrame.screenShot(js.exec_dir + "/screenshots/transporter-" + ssStr + ".bin", false);
		ss++;
	}
	for (var pauser=0; pauser<2000; pauser++) {
		console.putmsg('\033[1C\033[1D', mode=P_NOPAUSE );
		mswait(3);
	}


	msgFrame.load(js.exec_dir + '/graphics/bubble2.bin');
	msgFrame.moveTo(43,1);
	msgFrame.gotoxy(0,2);
	msgFrame.center('Oh, wonderful! ');
	msgFrame.crlf();
	msgFrame.center('But ... my sack!');
	msgFrame.cycle();

	if (screenShot) {
		var ssStr = ss.toString().rjust(4,'0');
		bgFrame.screenShot(js.exec_dir + "/screenshots/transporter-" + ssStr + ".bin", false);
		ss++;
	}
	for (var pauser=0; pauser<2000; pauser++) {
		console.putmsg('\033[1C\033[1D', mode=P_NOPAUSE );
		mswait(3);
	}



	msgFrame.load(js.exec_dir + '/graphics/bubble2.bin');
	msgFrame.moveTo(43,20);
	msgFrame.gotoxy(0,2);
	msgFrame.center('Aye! I might be able ');
	msgFrame.crlf();
	msgFrame.center('to re-materialize');
	msgFrame.crlf();
	msgFrame.center('the whole kit and kaboodle.');
	msgFrame.cycle();

	if (screenShot) {
		var ssStr = ss.toString().rjust(4,'0');
		bgFrame.screenShot(js.exec_dir + "/screenshots/transporter-" + ssStr + ".bin", false);
		ss++;
	}
	for (var pauser=0; pauser<2000; pauser++) {
		console.putmsg('\033[1C\033[1D', mode=P_NOPAUSE );
		mswait(3);
	}
	msgFrame.close();



	// Light up the transporter pad
	transporterPadFrame.moveTo(44, 20);
	transporterPadFrame.open();
	transporterPadFrame.cycle();
	if (screenShot) {
		var ssStr = ss.toString().rjust(4,'0');
		bgFrame.screenShot(js.exec_dir + "/screenshots/transporter-" + ssStr + ".bin", false);
		ss++;
	}
	for (var pauser=0; pauser<200; pauser++) {
		console.putmsg('\033[1C\033[1D', mode=P_NOPAUSE );
		mswait(3);
	}

	emptyFrame( transporterEffectFrame );
	transporterEffectFrame.moveTo(40, 1);
	transporterEffectFrame.open();
	transport( sackSpriteFrame, transporterEffectFrame );

	transporterPadFrame.close();
	transporterEffectFrame.close();
	bgFrame.invalidate();
	sackSpriteFrame.open();
	sackSpriteFrame.top();
	sackSpriteFrame.cycle();

	if (screenShot) {
		var ssStr = ss.toString().rjust(4,'0');
		bgFrame.screenShot(js.exec_dir + "/screenshots/transporter-" + ssStr + ".bin", false);
		ss++;
	}
	for (var pauser=0; pauser<333; pauser++) {
		console.putmsg('\033[1C\033[1D', mode=P_NOPAUSE );
		mswait(3);
	}


	msgFrame.load(js.exec_dir + '/graphics/bubble2.bin');
	msgFrame.moveTo(43,1);
	msgFrame.gotoxy(0,2);
	msgFrame.center('Oh, Mr. Scott,');
	msgFrame.crlf();
	msgFrame.center('you are a miracle worker.');
	msgFrame.crlf();
	msgFrame.center('You saved Christmas!');
	msgFrame.open();
	msgFrame.cycle();

	if (screenShot) {
		var ssStr = ss.toString().rjust(4,'0');
		bgFrame.screenShot(js.exec_dir + "/screenshots/transporter-" + ssStr + ".bin", false);
		ss++;
	}
	for (var pauser=0; pauser<2000; pauser++) {
		console.putmsg('\033[1C\033[1D', mode=P_NOPAUSE );
		mswait(3);
	}



	fgFrame.top();
	fgFrame.cycle();
	wipeDown(fgFrame,1,BLACK|BG_BLACK,1);




	// ============================
	// END CREDITS SCREEN ANIMATION
	// ============================

	var colors = [ highBlack, lowCyan, highCyan ];
	var titles = [ 'For', 'Directed by'  ];
	var names = [ 'RON', 'KIRKMAN' ];

	bgFrame1.close();
	bgFrame1.delete();

	for (var t=0; t<titles.length; t++) {
		for (var c=0; c<colors.length; c++) {
			fgFrame.gotoxy(0,11);
			fgFrame.center( colors[c] + titles[t] );
			fgFrame.crlf();
			fgFrame.center( colors[c] + names[t] );
			fgFrame.crlf();
			bgFrame.cycle();
			if (screenShot) {
				var ssStr = ss.toString().rjust(4,'0');
				bgFrame.screenShot(js.exec_dir + "/screenshots/transporter-" + ssStr + ".bin", false);
				ss++;
			}
			for (var pauser=0; pauser<28; pauser++) {
				console.putmsg('\033[1C\033[1D', mode=P_NOPAUSE );
				mswait(3);
			}
			mswait(80);
		}
		for (var pauser=0; pauser<800; pauser++) {
			console.putmsg('\033[1C\033[1D', mode=P_NOPAUSE );
			mswait(3);
		}
		for (var c=colors.length-1; c>-1; c--) {
			fgFrame.gotoxy(0,11);
			fgFrame.center( colors[c] + titles[t] );
			fgFrame.crlf();
			fgFrame.center( colors[c] + names[t] );
			fgFrame.crlf();
			bgFrame.cycle();
			if (screenShot) {
				var ssStr = ss.toString().rjust(4,'0');
				bgFrame.screenShot(js.exec_dir + "/screenshots/transporter-" + ssStr + ".bin", false);
				ss++;
			}
			for (var pauser=0; pauser<28; pauser++) {
				console.putmsg('\033[1C\033[1D', mode=P_NOPAUSE );
				mswait(3);
			}
		}

	}
} // play()



function cleanup() {
	var allFrames = [
		santaSpriteFrame,
		sackSpriteFrame,
		transporterPadFrame,
		transporterEffectFrame,
		msgFrame,
		fgFrame,
		bgFrame1,
		bgFrame
	];

	for (var af=0; af < allFrames.length; af++ ) {
 		allFrames[af].close();
	 	allFrames[af].delete();
	}
}


function main_loop() {
	makeBg();
	play();
	cleanup();
	exit();
}



// Run the animation
main_loop();


