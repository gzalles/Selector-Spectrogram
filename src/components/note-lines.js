import React, {Component} from 'react';
import generateScale from '../util/generateScale';
import Tone from 'tone';

class NoteLines extends Component {

  constructor(props) {
    super(props);
    this.onMouseMove = this.onMouseMove.bind(this);
  }

  componentDidMount() {
    this.ctx = this.canvas.getContext('2d');
    window.addEventListener("resize", this.handleResize);
    Tone.context = this.props.context;
    let options = {
      oscillator: {
        type: "sine"
      },

    };
    this.synth = new Tone.Synth(options);
    this.masterVolume = new Tone.Volume(-2);
    this.synth.connect(this.masterVolume);
    this.masterVolume.connect(Tone.Master);
    this.masterVolume.mute = !this.props.soundOn;
    this.frequencies = [];
    this.freq = 1;
    this.renderNoteLines();

  }
  componentWillUnmount() {
    window.removeEventListener("resize", this.handleResize);
    this.masterVolume.mute = true;

  }
  componentWillReceiveProps(nextProps, prevState) {
    if (nextProps.soundOn === false) {
      this.masterVolume.mute = true;
    } else {
      this.masterVolume.mute = false;
    }
    if (this.masterVolume.mute === false && nextProps.outputVolume && nextProps.outputVolume !== this.masterVolume.volume.value ) {
      this.masterVolume.volume.value = this.getGain(1 - (nextProps.outputVolume) / 100);
    }
  }

  onMouseMove(e) {
    e.preventDefault();
      let {height, width} = this.props;
      let pos = this.getMousePos(this.canvas, e);
      let yPercent = 1 - pos.y / this.props.height;
      let xPercent = 1 - pos.x / this.props.width;
      let gain = this.getGain(xPercent);
      let freq = this.newFreqAlgorithm(yPercent);
      if(this.props.soundOn){
        for(let j = 0; j < this.frequencies.length; j++){
          if(Math.abs(this.frequencies[j] - freq) < 0.01 * freq){
            if(this.frequencies[j] !== this.freq){
              this.synth.triggerRelease();
              this.ctx.fillStyle = 'white';
              let oldIndex = this.freqToIndex(this.freq);
              this.ctx.fillRect(0, oldIndex, width, 2);
              this.freq = this.frequencies[j];
              let index = this.freqToIndex(this.frequencies[j]);
              this.ctx.fillStyle = 'gold';
              this.ctx.fillRect(0, index, width, 1);
              this.synth.triggerAttack(freq);
            }
            this.synth.volume.value = gain;
            break;
          }
        }
      }

  }

  getMousePos(canvas, evt) {
    var rect = canvas.getBoundingClientRect(), // abs. size of element
      scaleX = canvas.width / rect.width, // relationship bitmap vs. element for X
      scaleY = canvas.height / rect.height; // relationship bitmap vs. element for Y

    return {
      x: (evt.clientX - rect.left) * scaleX, // scale mouse coordinates after they have
      y: (evt.clientY - rect.top) * scaleY // been adjusted to be relative to element
    }
  }

  newFreqAlgorithm(index) {
    let logResolution = Math.log(this.props.resolutionMax / this.props.resolutionMin);
    let freq = this.props.resolutionMin * Math.pow(Math.E, index * logResolution);
    return freq;
  }
  // Helper function that turns the x-pos into a decibel value for the volume
  getGain(index) {
    //-60 to 0dB
    return -1 * (index * 60);
  }

  handleResize = () => {
    this.props.handleResize();
    this.renderNoteLines();
  }

  renderNoteLines = () => {
    let {height, width} = this.props;
    this.ctx.clearRect(0, 0, width, height);
    this.ctx.fillStyle = 'white';

    //  Maps to one of the 12 keys of the piano based on note and accidental
    let newIndexedKey = this.props.musicKey.value;
    // Edge cases
    if (newIndexedKey === 0 && this.props.accidental.value === 2) {
      // Cb->B
      newIndexedKey = 11;
    } else if (newIndexedKey === 11 && this.props.accidental.value === 1) {
      // B#->C
      newIndexedKey = 0;
    } else {
      newIndexedKey = (this.props.accidental.value === 1)
        ? newIndexedKey + 1
        : (this.props.accidental.value === 2)
          ? newIndexedKey - 1
          : newIndexedKey;
    }

    this.frequencies = [];
    // Uses generateScale helper method to generate base frequency values
    let s = generateScale(newIndexedKey, this.props.scale.value);
    //Sweeps through scale object and draws frequency
    for (let i = 0; i < s.scale.length; i++) {
      let freq = s.scale[i];

      for (let j = 0; j < 15; j++) {
        if (freq > this.props.resolutionMax) {

          break;
        } else {
          let index = this.freqToIndex(freq);
          this.frequencies.push(Math.round(freq));
          this.ctx.fillRect(0, index, width, 2);
          freq = freq * 2;
        }
      }
    }

  }



  freqToIndex(freq) {
    let logResolution = Math.log(this.props.resolutionMax / this.props.resolutionMin);
    let x = Math.log(freq / this.props.resolutionMin) / logResolution;

    // console.log(x*100);
    if (!isNaN(x)) {
      return (1 - x) * this.props.height;
    }
    return 0;
  }
  render() {
    return (<canvas
      width={this.props.width}
      height={this.props.height}
      onMouseMove={this.onMouseMove}
      ref={(c) => {
      this.canvas = c;
    }}/>);
  }
}
export default NoteLines;
