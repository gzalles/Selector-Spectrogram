// Helper Function for Conversion to log for outputVolume, graph scale
function convertToLog(value, originalMin, originalMax, newMin, newMax){
  //solving y=Ae^bx for y
  let b = Math.log(newMax / newMin)/(originalMax-originalMin);
  let a = newMax /  Math.pow(Math.E,  originalMax* b);
  let y = a *Math.pow(Math.E, b*value);
  // console.log(y);
  return y;
}

function convertToLinear(value, originalMin, originalMax, newMin, newMax){
  //solving y=Ae^bx for x, x=ln(y-A)/b
      let b = Math.log(newMax / newMin)/(originalMax-originalMin);
      let a = newMax /  Math.pow(Math.E,  originalMax* b);
      let x = Math.log(value - a)/b;
    return x;
}

function getMousePos(canvas, evt) {
  var rect = canvas.getBoundingClientRect(), // abs. size of element
    scaleX = canvas.width / rect.width, // relationship bitmap vs. element for X
    scaleY = canvas.height / rect.height; // relationship bitmap vs. element for Y

  return {
    x: (evt.clientX - rect.left) * scaleX, // scale mouse coordinates after they have
    y: (evt.clientY - rect.top) * scaleY // been adjusted to be relative to element
  }
}

function getFreq(index, min, max) {
  let logResolution = Math.log(max / min);
  let freq = min * Math.pow(Math.E, index * logResolution);
  return Math.round(freq);
}

// Helper function that turns the x-pos into a decibel value for the volume
function getGain(index) {
  //1 t0 0 ->
  //-30 to 0dB
  index = index - 0.1;
  return -1 * (index * 30);
}

// Tempo between 50 and 200
function getTempo(index){
  return Math.round((1-index)*150 + 50);
}

function calculateNewMax(y, A0, newYPercent){
  // A1 == A0
    let B1 = Math.log(y/A0)/newYPercent;
    let newMax = Math.pow(Math.E, B1)*A0;
    return newMax;
}

function calculateNewMin(y, A0, newYPercent, zoomMin, zoomMax){
  // A1e^b1 = A0e^b0
    let logResolution = Math.log(zoomMax / zoomMin); //b0
    let intermediate = Math.log(y/A0)-logResolution;
    let B1 = intermediate/(newYPercent - 1)
    let newMin = zoomMax/Math.pow(Math.E, B1);
    return newMin;
}

function freqToIndex(freq, max, min, height) {
  let logResolution = Math.log(max / min);
  let x = Math.log(freq / min) / logResolution;
  if (!isNaN(x)) {
    return (1 - x) * height;
  }
  return 0;
}

function gainToLinear(gain) {
  return (-1*(gain / 30) + 0.1);
}

function midiToFreq(midi){
  return Math.pow(2, ((midi - 69) / 12)) * 440;
}

function getColorIndicesForCoord(x, y, width) {
  var red = y * (width * 4) + x * 4;
  return [red, red + 1, red + 2, red + 3];
}

// dont think this is being used
function getHarmonicWeightInExpScale(weight) {
  let expval = (Math.exp(weight*Math.log(1000)))/1000;
  return expval;
}

function convertHarmonicScaleToLog(value, numharmonics){
  // value = Math.round(value)/10;
  // let b = 2;
  // let a = value /  Math.pow(Math.E, b);
  // let y = a *Math.pow(Math.E, b*value);
  // console.log("input:" + value + ", conversion:" + y);
  // return y;
  // let factor = Math.log(1000*numharmonics)/numharmonics;

  // let val = Math.exp(value*factor)/1000;


  let val = Math.pow(value, 3)/Math.pow(numharmonics,2);
  val = Math.round(val)/10;
  // console.log("input:" + value + ", conversion:" + val);
  return val;
}

function scaleFilter(value, coefficient) {
  let b = coefficient;
  let a = value /  Math.pow(Math.E, b);
  let y = a *Math.pow(Math.E, b*value);
  // console.log(y);
  return y;
}

export {convertToLog, convertToLinear, getMousePos, getFreq, getGain, calculateNewMax, calculateNewMin, freqToIndex, getTempo, midiToFreq, gainToLinear, getColorIndicesForCoord, getHarmonicWeightInExpScale, convertHarmonicScaleToLog, scaleFilter}
