import React, {Component} from 'react';
import Tone from 'tone';

const NUM_VOICES = 6;
class Oscillator extends Component {
  // TODO: Volume, Touch Move
  constructor(props) {
    super();
    this.onMouseDown = this.onMouseDown.bind(this);
    this.onMouseUp = this.onMouseUp.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseOut = this.onMouseOut.bind(this);
    this.onTouchStart = this.onTouchStart.bind(this);
    this.onTouchEnd = this.onTouchEnd.bind(this);
    this.onTouchMove = this.onTouchMove.bind(this);
    this.state = {
      lastX: -1,
      lastY: -1,
      lastFreq: new Array(NUM_VOICES),
      mouseDown: false,
      touch: false,
      currentVoice: -1,
      voices: 0 //voices started with on event
    }

  }
  componentDidMount() {
    Tone.context = this.props.context;
    this.synth = new Tone.PolySynth(NUM_VOICES, Tone.Synth);
    this.synth.voices.forEach((voice) => {
      voice.oscillator.type = "sine";
    });
    this.volume = new Tone.Volume(-30);
    this.synth.chain(this.volume, Tone.Master);

  }

  onMouseDown(e) {
    e.preventDefault();
    this.synth = new Tone.PolySynth(NUM_VOICES, Tone.Synth);
    this.synth.voices.forEach((voice) => {
      voice.oscillator.type = "sine";
    });
    this.volume = new Tone.Volume(-30);
    this.synth.chain(this.volume, Tone.Master);
    let percent = (1 - e.pageY / this.props.height);
    let freq = this.newFreqAlgorithm(percent);
    // let newVoice = (this.state.currentVoice + 1) % NUM_VOICES;
    let newFreq = [freq,...this.state.lastFreq.slice(1)];
    this.synth.triggerAttack(freq);

    this.setState({
      lastX: e.pageX,
      lastY: e.pageY,
      lastFreq: newFreq,
      mouseDown: true,
      currentVoice: 0,
      voices: this.state.voices + 1
    });

  }
  onMouseMove(e) {

    e.preventDefault();
    if (this.state.mouseDown) {

      let percent = (1 - e.pageY / this.props.height);
      let freq = this.newFreqAlgorithm(percent);
      let newFreq = [
        ...this.state.lastFreq.slice(0, this.state.currentVoice),
        freq,
        ...this.state.lastFreq.slice(this.state.currentVoice)
      ];
      this.synth.voices[this.state.currentVoice].frequency.value = freq;
      this.setState({
        lastX: e.pageX,
        lastY: e.pageY,
        lastFreq: newFreq.slice(0, NUM_VOICES)
      });
    }

  }
  onMouseUp(e) {
    e.preventDefault();
    this.synth.releaseAll();
    this.setState({mouseDown: false})

  }
  onMouseOut(e) {
    e.preventDefault();

  }
  onTouchStart(e) {
    e.preventDefault();

    for (let i = 0; i < e.touches.length; i++) {
      let percent = (1 - e.touches[i].pageY / this.props.height);
      let freq = this.newFreqAlgorithm(percent);
      let newVoice = (this.state.currentVoice + 1) % NUM_VOICES;
      let newFreq = [
        ...this.state.lastFreq.slice(0, newVoice),
        freq,
        ...this.state.lastFreq.slice(newVoice + 1)
      ];

      this.setState({
        lastX: e.pageX,
        lastY: e.pageY,
        lastFreq: newFreq.slice(0, NUM_VOICES),
        touch: true,
        currentVoice: newVoice,
        voices: this.state.voices + 1
      });
      this.synth.triggerAttack(freq);

    }
  }
  onTouchMove(e) {
    e.preventDefault();
    // console.log("TM");

  }
  onTouchEnd(e) {
    e.preventDefault();
    // console.log(e.changedTouches);
    if (e.changedTouches.length === e.touches.length + 1) {
      this.synth.releaseAll();
      let newVoice = (this.state.currentVoice + 1) % NUM_VOICES;

      this.setState({
        lastFreq: new Array(NUM_VOICES),
        voices: 0,
        touch: false
      });
    } else {
      for (let i = 0; i < e.changedTouches.length; i++) {

        let index = ((this.state.currentVoice - (this.state.voices - 1)) + e.changedTouches[i].identifier) % NUM_VOICES;
        if (index < 0) {
          index = NUM_VOICES + index;
        }
        let freq = this.state.lastFreq[index];
        this.synth.triggerRelease(freq);
        let newFreq = [
          ...this.state.lastFreq.slice(0, index),
          undefined,
          ...this.state.lastFreq.slice(index + 1)
        ];

        this.setState({
          lastFreq: newFreq.slice(0, NUM_VOICES),
          touch: false
        });
      }
    }
  }

  newFreqAlgorithm(index) {
    let logResolution = Math.log(this.props.resolutionMax / this.props.resolutionMin);
    let freq = this.props.resolutionMin * Math.pow(Math.E, index * logResolution);
    return Math.round(freq);
  }
  render() {
    return (<canvas onContextMenu={(e) => e.preventDefault()} onMouseDown={this.onMouseDown} onMouseUp={this.onMouseUp} onMouseMove={this.onMouseMove} onMouseOut={this.onMouseOut} onTouchStart={this.onTouchStart} onTouchEnd={this.onTouchEnd} onTouchMove={this.onTouchMove} width={this.props.width} height={this.props.height} ref={(c) => {
      this.canvas = c;
    }}/>);
  }
}

export default Oscillator;
