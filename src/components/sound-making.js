import React, {Component} from 'react';
import Tone from 'tone';
import "../styles/sound-making.css";
import {MyContext} from './my-provider';

import generateScale from '../util/generateScale';

import { getFreq, getGain, getTempo, freqToIndex, getMousePos, convertToLog, convertToLinear } from "../util/conversions";

const NUM_VOICES = 6;
const RAMPVALUE = 0.2;
const NOTE_JUMP = 1.0594630943593;

// Main sound-making class. Can handle click and touch inputs
class SoundMaking extends Component {
  // TODO: Sometimes strange sounds
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
      mouseDown: false,
      touch: false,
      currentVoice: 0,
      voices: 0, //voices started with on event
      feedback: false,
      amOn: false,
      fmOn: false,
      pitchButtonPressed:false
    }

  }

  // Setup Tone and all of its needed dependencies.
  // To view signal flow, check out signal_flow.png
  componentDidMount() {
    Tone.context = this.props.audioContext;
    // Array to hold synthesizer objects. Implemented in a circular way
    // so that each new voice (touch input) is allocated, it is appended to the
    // array until the array is full and it then appends the next voice to array[0]
    this.synths = new Array(NUM_VOICES);
    this.amSignals = new Array(NUM_VOICES);
    this.fmSignals = new Array(NUM_VOICES);
    this.heldFreqs = new Array(NUM_VOICES);
    this.heldIds = new Array(NUM_VOICES);
    this.bendStartPercents = new Array(NUM_VOICES);
    this.bendStartFreqs = new Array(NUM_VOICES);
    this.bendStartVolumes = new Array(NUM_VOICES);

    // Start master volume at -20 dB
    this.masterVolume = new Tone.Volume(0);
    this.ctx = this.canvas.getContext('2d');
    let options = {
      oscillator: {
        type: this.context.state.timbre.toLowerCase()
      }
    };
    let options2 = {
      oscillator: {
        type: 'sine'
      }
    }


    // For each voice, create a synth and connect it to the master volume
    for (let i = 0; i < NUM_VOICES; i++) {
      this.synths[i] = new Tone.Synth(options);
      this.synths[i].connect(this.masterVolume);
      this.synths[i].sync();
      this.amSignals[i] = new Tone.Synth(options2);
      this.amSignals[i].connect(this.synths[i].volume);
      this.fmSignals[i] = new Tone.Synth(options2);
      this.fmSignals[i].connect(this.synths[i].frequency);
      this.bendStartPercents[i] = 0;
      this.bendStartFreqs[i] = 0;
      this.bendStartVolumes[i] = 0;

    }
    this.drawPitchBendButton(false);


    this.goldIndices = []; // Array to hold indices on the screen of gold note lines (touched/clicked lines)
    this.masterVolume.connect(Tone.Master); // Master volume receives all of the synthesizer inputs and sends them to the speakers

    this.reverb = new Tone.Reverb(this.context.state.reverbDecay*10+0.1); // Reverb unit. Runs in parallel to masterVolume
    this.reverbVolume = new Tone.Volume(0);
    this.reverbVolume.mute = true;

    this.reverbVolume.connect(Tone.Master);
    this.masterVolume.connect(this.reverb);
    this.reverb.generate().then(()=>{
      this.reverb.connect(this.reverbVolume);
    });
    this.delay = new Tone.FeedbackDelay(this.context.state.delayTime+0.01, this.context.state.delayFeedback); // delay unit. Runs in parallel to masterVolume
    this.masterVolume.connect(this.delay);

    // this.amSignal.volume.value = -Infinity;

    this.delayVolume = new Tone.Volume(0);
    this.delayVolume.mute = true;

    this.delay.connect(this.delayVolume);

    this.delayVolume.connect(Tone.Master);
    // Sound Off by default
    this.masterVolume.mute = !this.context.state.soundOn;
    // Object to hold all of the note-line frequencies (for checking the gold lines)
    this.frequencies = {};
    if(this.context.state.noteLinesOn){
      this.renderNoteLines();
    }
    window.addEventListener("resize", this.handleResize);
    // var pattern = new Tone.Pattern((t,n) => {
    //   this.synths[0].triggerAttackRelease(n, "8n", t)
    // }, ["C4", "E4", "G4", "B4"], "upDown")
    // Tone.Transport.bpm.value = 200
    // pattern.start();
    Tone.Transport.start();

  }

// Sets up what will happen on controls changes
  setAudioVariables(){
    if (this.context.state.soundOn === false) {
      this.masterVolume.mute = true;
    } else {
      this.masterVolume.mute = false;
    }
    if (this.masterVolume.mute === false && this.context.state.outputVolume && this.context.state.outputVolume !== this.masterVolume.volume.value ) {
      this.masterVolume.volume.value = getGain(1 - (this.context.state.outputVolume) / 100);
    }
    if (this.context.state.timbre !== this.synths[0].oscillator.type) {
      let newTimbre = this.context.state.timbre.toLowerCase();
      for (let i = 0; i < NUM_VOICES; i++) {
        this.synths[i].oscillator.type = newTimbre;
      }
    }
    if (this.context.state.attack !== this.synths[0].envelope.attack) {
      for (let i = 0; i < NUM_VOICES; i++) {
        this.synths[i].envelope.attack = this.context.state.attack;
      }
    }
    if (this.context.state.release !== this.synths[0].envelope.release) {
      for (let i = 0; i < NUM_VOICES; i++) {
        this.synths[i].envelope.release = this.context.state.release;
      }
    }
    if(this.context.state.headphoneMode){
      // If Headphone Mode, connect the masterVolume to the graph
      if(!this.state.feedback){
        this.masterVolume.connect(this.props.analyser);
        this.reverbVolume.connect(this.props.analyser);
        this.delayVolume.connect(this.props.analyser)
        this.setState({feedback: true});
      }
    } else {
      if(this.state.feedback){
        this.masterVolume.disconnect(this.props.analyser);
        this.reverbVolume.disconnect(this.props.analyser);
        this.delayVolume.disconnect(this.props.analyser)
        this.setState({feedback: false});
      }
    }
    // if(this.context.state.noteLinesOn){
    //   this.ctx.clearRect(0, 0, this.context.state.width, this.context.state.height);
    //   this.renderNoteLines();
    // } else {
    //   this.ctx.clearRect(0, 0, this.context.state.width, this.context.state.height);
    // }
    if(this.context.state.reverbOn){
      this.reverbVolume.mute = false;
      this.masterVolume.disconnect(this.reverb);
      this.reverb = null;
      this.reverb = new Tone.Reverb(this.context.state.reverbDecay*10+0.1); // Reverb unit. Runs in parallel to masterVolume
      this.masterVolume.connect(this.reverb);
      this.reverb.generate().then(()=>{
        this.reverb.connect(this.reverbVolume);
        // this.reverb.decay = this.context.state.reverbDecay*15;
      });
    } else {
      this.reverbVolume.mute = true;
    }
    if(this.context.state.delayOn){
      this.delayVolume.mute = false;
      this.masterVolume.disconnect(this.delay);
      this.delay = null;
      this.delay = new Tone.FeedbackDelay(this.context.state.delayTime+0.01, this.context.state.delayFeedback);
      this.masterVolume.connect(this.delay);
      this.delay.connect(this.delayVolume);
    } else {
      this.delayVolume.mute = true;
    }
  }


  componentWillUnmount() {
    this.masterVolume.mute = true;
    window.removeEventListener("resize", this.handleResize);
  }

  /**
  This Section controls how the SoundMaking(s) react to user input
  */
  onMouseDown(e) {
    e.preventDefault(); // Always need to prevent default browser choices
    this.setAudioVariables();
    let pos = getMousePos(this.canvas, e);
    // Calculates x and y value in respect to width and height of screen
    // The value goes from 0 to 1. (0, 0) = Bottom Left corner
    let yPercent = 1 - pos.y / this.context.state.height;
    let xPercent = 1 - pos.x / this.context.state.width;
    let freq = this.getFreq(yPercent);
    let gain = getGain(xPercent);
    // newVoice = implementation of circular array discussed above.
    let newVoice = (this.state.currentVoice + 1) % NUM_VOICES; // Mouse always changes to new "voice"
    if(this.context.state.quantize){

      Tone.Transport.scheduleRepeat(time => {
        this.synths[newVoice].triggerAttackRelease(this.heldFreqs[newVoice], "@8n."); // Starts the synth at frequency = freq
      }, "4n");
      this.heldFreqs[newVoice] = freq;
      // console.log(getTempo(xPercent))
      // Tone.Transport.bpm.value = getTempo(xPercent);
      this.synths[newVoice].volume.value = gain; // Starts the synth at volume = gain
    } else {
      this.synths[newVoice].triggerAttack(freq); // Starts the synth at frequency = freq
      this.synths[newVoice].volume.value = gain; // Starts the synth at volume = gain

    }


    // Am
    if(this.context.state.amOn){
      let newVol = convertToLog(this.context.state.amLevel, 0, 1, 0.01, 15); // AM amplitud;e set between 0.01 and 15 (arbitray choices)
      let newFreq = convertToLog(this.context.state.amRate, 0, 1, 0.5, 50); // AM frequency set between 0.5 and 50 hz (arbitray choices)
      this.amSignals[newVoice].volume.exponentialRampToValueAtTime(newVol, this.props.audioContext.currentTime+1); // Ramps to AM amplitude in 1 sec
      this.amSignals[newVoice].triggerAttack(newFreq);
    }
    // FM
    if(this.context.state.fmOn){
      let modIndex = (1-freqToIndex(freq, 20000, 20, 1))*1.2; // FM index ranges from 0 - 2
      let newVol = convertToLog(this.context.state.fmLevel, 0, 1, 25, 50); // FM amplitude set between 30 and 60 (arbitrary choices)
      let newFreq = convertToLog(this.context.state.fmRate, 0, 1, 0.5, 50); // FM Frequency set between 0.5 and 50 (arbitray choices)
      // let newFreq = convertToLog(yPercent, 0, 1, 0.5, 20); // FM Frequency set between 0.5 and 20 (arbitray choices)
      this.fmSignals[newVoice].volume.exponentialRampToValueAtTime(newVol*modIndex, this.props.audioContext.currentTime+RAMPVALUE); // Ramps to FM amplitude*modIndex in RAMPVALUE sec
      this.fmSignals[newVoice].triggerAttack(newFreq);
    }

    this.ctx.clearRect(0, 0, this.context.state.width, this.context.state.height); // Clears canvas for redraw of label
    this.setState({
      mouseDown: true,
      currentVoice: newVoice,
      voices: this.state.voices + 1,
    });
    if(this.context.state.noteLinesOn){
      this.renderNoteLines();
    }
    this.label(freq, pos.x, pos.y); // Labels the point
    this.drawPitchBendButton(false);


  }
  onMouseMove(e) {
    e.preventDefault(); // Always need to prevent default browser choices
    if (this.state.mouseDown) { // Only want to change when mouse is pressed
      // The next few lines are similar to onMouseDown

      let {height, width} = this.context.state
      let pos = getMousePos(this.canvas, e);
      let yPercent = 1 - pos.y / height;
      let xPercent = 1 - pos.x / width;
      let gain = getGain(xPercent);
      let freq = this.getFreq(yPercent);
      // Remove previous gold indices and update them to new positions
      this.goldIndices.splice(this.state.currentVoice - 1, 1);
      if(this.context.state.scaleOn){
        // Jumps to new Frequency and Volume
        if(this.context.state.quantize){
            this.heldFreqs[this.state.currentVoice] = freq;
            // let tempo = getTempo(xPercent);
            // let outputTempo = 0.5*(tempo + Tone.Transport.bpm.value);
            // console.log(outputTempo)
            // if(Math.abs(outputTempo - Tone.Transport.bpm.value) > 0.05*Tone.Transport.bpm.value){
            //   Tone.Transport.bpm.value = +outputTempo;
            //   console.log("Changed")
            // }
        } else {
          this.synths[this.state.currentVoice].frequency.value = freq;
          this.synths[this.state.currentVoice].volume.value = gain;
        }

      } else {
        if(this.context.state.quantize){
            let tempo = getTempo(xPercent);
            this.heldFreqs[this.state.currentVoice] = freq;
            // console.log(tempo)
        } else {
        // Ramps to new Frequency and Volume
        this.synths[this.state.currentVoice].frequency.exponentialRampToValueAtTime(freq, this.props.audioContext.currentTime+RAMPVALUE);
        // // Ramp to new Volume
        this.synths[this.state.currentVoice].volume.exponentialRampToValueAtTime(gain,
          this.props.audioContext.currentTime+RAMPVALUE);
        }

      }
      // FM
      if(this.context.state.fmOn){
        let modIndex = (1-freqToIndex(freq, 20000, 20, 1))*1.2
        let newVol = convertToLog(this.context.state.fmLevel, 0, 1, 25, 50); // FM amplitude set between 30 and 60 (arbitrary choices)
        let newFreq = convertToLog(this.context.state.fmRate, 0, 1, 0.5, 50); // FM Frequency set between 0.5 and 50 (arbitray choices)
        // let newFreq = convertToLog(yPercent, 0, 1, 0.5, 20); // FM Frequency set between 0.5 and 20 (arbitray choices)
        this.fmSignals[this.state.currentVoice].volume.exponentialRampToValueAtTime(newVol*modIndex, this.props.audioContext.currentTime+RAMPVALUE); // Ramps to FM amplitude*modIndex in RAMPVALUE sec
        this.fmSignals[this.state.currentVoice].triggerAttack(newFreq);
      }


      // Clears the label
      this.ctx.clearRect(0, 0, this.context.state.width, this.context.state.height);
      if(this.context.state.noteLinesOn){
        this.renderNoteLines();
      }
      this.drawPitchBendButton(false);

      this.label(freq, pos.x, pos.y);
    }

  }
  onMouseUp(e) {
    e.preventDefault(); // Always need to prevent default browser choices
    // Only need to trigger release if synth exists (a.k.a mouse is down)
    if (this.state.mouseDown) {
      Tone.Transport.cancel();

      this.synths[this.state.currentVoice].triggerRelease(); // Relase frequency, volume goes to -Infinity
      this.amSignals[this.state.currentVoice].triggerRelease();
      this.fmSignals[this.state.currentVoice].triggerRelease();
      this.setState({mouseDown: false, voices: 0});
      this.goldIndices = [];

      // Clears the label
      this.ctx.clearRect(0, 0, this.context.state.width, this.context.state.height);
      if(this.context.state.noteLinesOn){
        this.renderNoteLines();
      }
      this.drawPitchBendButton(false);

    }

  }
  /* This is a similar method to onMouseUp. Occurs when mouse exists canvas */
  onMouseOut(e) {
    e.preventDefault(); // Always need to prevent default browser choices
    if (this.state.mouseDown) {
      Tone.Transport.cancel();
      this.synths[this.state.currentVoice].triggerRelease();
      this.amSignals[this.state.currentVoice].triggerRelease();
      this.fmSignals[this.state.currentVoice].triggerRelease();
      this.setState({mouseDown: false, voices: 0});
      this.goldIndices = [];

      // Clears the label
      this.ctx.clearRect(0, 0, this.context.state.width, this.context.state.height);
      if(this.context.state.noteLinesOn){
        this.renderNoteLines();
        // this.amSignals[this.state.currentVoice].stop();
      }
      this.drawPitchBendButton(false);

    }
  }

  /*The touch section is the same as the mouse section with the added feature of
  multitouch and vibrato. For each finger down, this function places a frequency
  and volume value into the next available position in the synth array
  (implmented as a circular array).
  */
  onTouchStart(e) {
    e.preventDefault(); // Always need to prevent default browser choices
    e.stopPropagation();
    this.setAudioVariables();

    if(e.touches.length > NUM_VOICES ){
      return;
    }
    this.ctx.clearRect(0, 0, this.context.state.width, this.context.state.height);

    if(this.context.state.noteLinesOn){
      this.renderNoteLines();
    }
    // For each finger, do the same as above in onMouseDown
    for (let i = 0; i < e.changedTouches.length; i++) {
      let pos = getMousePos(this.canvas, e.changedTouches[i]);
      if (!this.isPitchButton(pos.x, pos.y)){
        let yPercent = 1 - pos.y / this.context.state.height;
        let xPercent = 1 - pos.x / this.context.state.width;
        let gain = getGain(xPercent);
        let freq = this.getFreq(yPercent);
        let newVoice = e.changedTouches[i].identifier % NUM_VOICES;
        if(newVoice < 0) newVoice = NUM_VOICES + newVoice;
        this.setState({
          touch: true,
        });
        if(this.context.state.quantize){
          let id = Tone.Transport.scheduleRepeat(time => {
            this.synths[newVoice].triggerAttackRelease(this.heldFreqs[newVoice], "@8n."); // Starts the synth at frequency = freq
          }, "4n");
          this.heldFreqs[newVoice] = freq;
          this.heldIds[newVoice] = id;
        } else {
          this.synths[newVoice].triggerAttack(freq);
        }
        this.synths[newVoice].volume.value = gain;
        // Am
        if(this.context.state.amOn){
          let newVol = convertToLog(this.context.state.amLevel, 0, 1, 0.01, 15); // AM amplitud;e set between 0.01 and 15 (arbitray choices)
          let newFreq = convertToLog(this.context.state.amRate, 0, 1, 0.5, 50); // AM frequency set between 0.5 and 50 hz (arbitray choices)
          this.amSignals[newVoice].volume.exponentialRampToValueAtTime(newVol, this.props.audioContext.currentTime+1); // Ramps to AM amplitude in 1 sec
          this.amSignals[newVoice].triggerAttack(newFreq);
        }
        // FM
        if(this.context.state.fmOn){
          let modIndex = (1-freqToIndex(freq, 20000, 20, 1)) *1.2 // FM index ranges from 0 - 2
          let newVol = convertToLog(this.context.state.fmLevel, 0, 1, 25, 50); // FM amplitude set between 30 and 60 (arbitrary choices)
          let newFreq = convertToLog(this.context.state.fmRate, 0, 1, 0.5, 50); // FM Frequency set between 0.5 and 50 (arbitray choices)
          // let newFreq = convertToLog(yPercent, 0, 1, 0.5, 20); // FM Frequency set between 0.5 and 20 (arbitray choices)
          this.fmSignals[newVoice].volume.exponentialRampToValueAtTime(newVol*modIndex, this.props.audioContext.currentTime+RAMPVALUE); // Ramps to FM amplitude*modIndex in RAMPVALUE sec
          this.fmSignals[newVoice].triggerAttack(newFreq);
        }

        this.drawPitchBendButton(this.state.pitchButtonPressed);
        if(this.state.pitchButtonPressed){
          this.bendStartPercents[newVoice] = yPercent;
          this.bendStartFreqs[newVoice] = freq;
          this.bendStartVolumes[newVoice] = gain;
        }

      } else {
        let newVoice = (this.state.currentVoice + 1) % NUM_VOICES;
        for (let i = 0; i < e.touches.length; i++) {
          let pos = getMousePos(this.canvas, e.touches[i]);
          let index = e.touches[i].identifier % NUM_VOICES;
          let yPercent = 1 - pos.y / this.context.state.height;
          let xPercent = 1 - pos.x / this.context.state.width;
          let gain = getGain(xPercent);
          let freq = this.getFreq(yPercent);
          if (!this.isPitchButton(pos.x, pos.y)){
            this.bendStartPercents[index] = yPercent;
            this.bendStartFreqs[index] = freq;
            this.bendStartVolumes[index] = gain;

          }
        }
        this.drawPitchBendButton(true);
        this.setState({pitchButtonPressed: true});
        }

    }
    for (let i = 0; i < e.touches.length; i++) {
      let pos = getMousePos(this.canvas, e.touches[i]);
      let yPercent = 1 - pos.y / this.context.state.height;
      let xPercent = 1 - pos.x / this.context.state.width;
      let freq = this.getFreq(yPercent);
      if (!this.isPitchButton(pos.x, pos.y)){
        this.label(freq, pos.x, pos.y);
      }
    }

  }
  onTouchMove(e) {
    e.preventDefault(); // Always need to prevent default browser choices
    // Check if more fingers were moved than allowed
    if(e.changedTouches.length > NUM_VOICES ){
      return;
    }
    let {width, height} = this.context.state;
    // If touch is pressed (Similar to mouseDown = true, although there should never be a case where this is false)
    this.ctx.clearRect(0, 0, width, height);
    if(this.context.state.noteLinesOn){
      this.renderNoteLines();
    }
    if (this.state.touch) {
      // Determines the current "starting" index to change
      // For each changed touch, do the same as onMouseMove
      for (let i = 0; i < e.changedTouches.length; i++) {
        let pos = getMousePos(this.canvas, e.changedTouches[i]);
        let yPercent = 1 - pos.y / this.context.state.height;
        let xPercent = 1 - pos.x / this.context.state.width;
        let gain = getGain(xPercent);

        let freq = this.getFreq(yPercent);
        // Determines index of the synth needing to change volume/frequency
        let index = e.changedTouches[i].identifier % NUM_VOICES;
        if(index < 0) index = NUM_VOICES + index;

          // Deals with rounding issues with the note lines
          let oldFreq = this.synths[index].frequency.value;
          for (let note in this.frequencies){
            if (Math.abs(this.frequencies[note] - oldFreq) < 0.1*oldFreq){
              oldFreq = this.frequencies[note]
            }
          }
          // These are the same as onMouseMove
          this.goldIndices.splice(index - 1, 1);
          if(this.context.state.scaleOn && !this.state.pitchButtonPressed){
            // Jumps to new Frequency and Volume
            if(this.context.state.quantize){
              this.heldFreqs[index] = freq;
            } else {
              this.synths[index].frequency.value = freq;
            }
            this.synths[index].volume.value = gain;
          } else {
            if(this.state.pitchButtonPressed){
              let dist = yPercent - this.bendStartPercents[index];
              freq = this.bendStartFreqs[index];
              freq = freq + freq*dist;
            }

            if(this.context.state.quantize){
            this.heldFreqs[index] = freq;
          } else {
            // Ramps to new Frequency and Volume
            this.synths[index].frequency.exponentialRampToValueAtTime(freq, this.props.audioContext.currentTime+RAMPVALUE);
          }
            // Ramp to new Volume
            this.synths[index].volume.exponentialRampToValueAtTime(gain,
              this.props.audioContext.currentTime+RAMPVALUE);
          }
          // FM
          if(this.context.state.fmOn){
            let modIndex = (1-freqToIndex(freq, 20000, 20, 1)) *1.2;// FM index ranges from 0 - 2
            let newVol = convertToLog(this.context.state.fmLevel, 0, 1, 25, 50); // FM amplitude set between 30 and 60 (arbitrary choices)
            let newFreq = convertToLog(this.context.state.fmRate, 0, 1, 0.5, 50); // FM Frequency set between 0.5 and 50 (arbitray choices)
            // let newFreq = convertToLog(yPercent, 0, 1, 0.5, 20); // FM Frequency set between 0.5 and 20 (arbitray choices)
            this.fmSignals[index].volume.exponentialRampToValueAtTime(newVol*modIndex, this.props.audioContext.currentTime+RAMPVALUE); // Ramps to FM amplitude*modIndex in RAMPVALUE sec
            this.fmSignals[index].triggerAttack(newFreq);
          }

      }
      //Redraw Labels
      this.drawPitchBendButton(this.state.pitchButtonPressed);
      for (let i = 0; i < e.touches.length; i++) {
        let pos = getMousePos(this.canvas, e.touches[i]);
        let yPercent = 1 - pos.y / this.context.state.height;
        let freq = this.getFreq(yPercent);
        if (!this.isPitchButton(pos.x, pos.y)){
          this.label(freq, pos.x, pos.y);
        }
      }

    }
  }
  onTouchEnd(e) {
    e.preventDefault(); // Always need to prevent default browser choices
    let {width, height} = this.context.state;
    this.ctx.clearRect(0, 0, width, height);
    if(this.context.state.noteLinesOn){
      this.renderNoteLines();
    }
    // Check if there are more touches changed than on the screen and release everything (mostly as an fail switch)
    if (e.changedTouches.length === e.touches.length + 1) {
      Tone.Transport.cancel();
      for (var i = 0; i < NUM_VOICES; i++) {
        this.synths[i].triggerRelease();
        this.amSignals[i].triggerRelease();
        this.fmSignals[i].triggerRelease();
      }
      this.goldIndices = [];
      this.drawPitchBendButton(false);

      this.setState({voices: 0, touch: false, notAllRelease: false, currentVoice: -1, pitchButtonPressed: false});
    } else {
      let checkButton = false;
      // Does the same as onTouchMove, except instead of changing the voice, it deletes it.
      for (let i = 0; i < e.changedTouches.length; i++) {
        let pos = getMousePos(this.canvas, e.changedTouches[i]);
        let index = e.changedTouches[i].identifier % NUM_VOICES;
        if(index < 0) index = NUM_VOICES + index;

        if(!this.isPitchButton(pos.x, pos.y)){
          if(this.state.pitchButtonPressed){
            // Ramps to new Frequency and Volume
            this.synths[index].frequency.exponentialRampToValueAtTime(this.bendStartFreqs[index], this.props.audioContext.currentTime+0.2);
            // Ramp to new Volume
            this.synths[index].volume.exponentialRampToValueAtTime(this.bendStartVolumes[index], this.props.audioContext.currentTime+0.05);
            this.bendStartPercents[index] = 0;
            this.bendStartFreqs[index] = 0;
            this.bendStartVolumes[index] = 0;
          }
          else {
            this.goldIndices.splice(index, 1);
            this.synths[index].triggerRelease();
            this.amSignals[index].triggerRelease();
            this.fmSignals[index].triggerRelease();
            if(this.context.state.quantize){
              Tone.Transport.clear(this.heldIds[index]);
            }
          }
          this.drawPitchBendButton(this.state.pitchButtonPressed);
        } else {
          if(e.touches.length == 0){
              for (var i = 0; i < NUM_VOICES; i++) {
                this.synths[i].triggerRelease();
                this.fmSignals[i].triggerRelease();
                this.amSignals[i].triggerRelease();
              }
          }
          this.setState({pitchButtonPressed: false});
          this.drawPitchBendButton(false);
          checkButton = true;
          }
      }
      if(!checkButton){
        let newVoice = this.state.currentVoice - e.changedTouches.length;
        newVoice = (newVoice < 0)
          ? (NUM_VOICES + newVoice)
          : newVoice;
        this.setState({currentVoice: newVoice});
      }


      }





    //Redraw Labels
    for (let i = 0; i < e.touches.length; i++) {
      let pos = getMousePos(this.canvas, e.touches[i]);
      let yPercent = 1 - pos.y / this.context.state.height;
      let freq = this.getFreq(yPercent);
      if(!this.isPitchButton(pos.x,pos.y)){
        this.label(freq, pos.x, pos.y);
      }
    }

  }

  // Helper function that determines the frequency to play based on the mouse/finger position
  // Also deals with snapping it to a scale if scale mode is on
  getFreq(index) {
    let {resolutionMax, resolutionMin, height} = this.context.state;
    let freq = getFreq(index, resolutionMin, resolutionMax);
    let notes = [];

    if (this.context.state.scaleOn) {
      //  Maps to one of the 12 keys of the piano based on note and accidental
      let newIndexedKey = this.context.state.musicKey.value;
      // Edge cases
      if (newIndexedKey === 0 && this.context.state.accidental.value === 2) {
        // Cb->B
        newIndexedKey = 11;
      } else if (newIndexedKey === 11 && this.context.state.accidental.value === 1) {
        // B#->C
        newIndexedKey = 0;
      } else {
        newIndexedKey = (this.context.state.accidental.value === 1)
          ? newIndexedKey + 1
          : (this.context.state.accidental.value === 2)
            ? newIndexedKey - 1
            : newIndexedKey;
      }
      // Uses generateScale helper method to generate base frequency values
      let s = generateScale(newIndexedKey, this.context.state.scale.value);
      let name = s.scale[0];
      let note = 0;
      let dist = 20000;
      let harmonic = 0;
      let finalJ = 0;
      let finalK = 0;
      //Sweeps through scale object and plays correct frequency
      for (var j = 1; j < 1500; j = j * 2) {

        for (var k = 0; k < s.scale.length; k++) {

          var check = j * s.scale[k];
          var checkDist = Math.abs(freq - check);
          if (checkDist < dist) {
            dist = checkDist;
            note = check;
            name = s.scaleNames[k];
            harmonic = Math.round(Math.log2(j) - 1);
            finalJ = j;
            finalK = k;
          } else {
            break;
          }
        }
      }
      freq = note;
      let textLabel = name + '' + harmonic;
      this.scaleLabel = textLabel;
      let index = freqToIndex(freq, resolutionMax, resolutionMin, height);

        this.goldIndices[this.state.currentVoice] = index;
        notes = s.scale.map(note=>{
          return note * finalJ;
        });
    }
    return Math.round(freq);
  }

  handleResize = () => {
    // this.props.handleResize();
    this.props.handleResize();
    this.ctx.clearRect(0, 0, this.context.state.width, this.context.state.height);
    if(this.context.state.noteLinesOn){
      this.renderNoteLines();
    }
    this.drawPitchBendButton(false);

  }

  // Helper method that generates a label for the frequency or the scale note
  label(freq, x, y) {
    const offset = 25;
    const scaleOffset = 10;
    this.ctx.font = '20px Inconsolata';
    this.ctx.fillStyle = 'white';
    if(this.context.state.soundOn){
      if (!this.context.state.scaleOn) {
        this.ctx.fillText(freq + ' Hz', x + offset, y - offset);
      } else {
        this.ctx.fillText(this.scaleLabel, x + offset, y - offset);
        let index = freqToIndex(freq, this.context.state.resolutionMax, this.context.state.resolutionMin, this.context.state.height);
        let width = ((freq+ ' Hz').length < 7) ? 70 : 80;
        this.ctx.fillStyle = "rgba(218, 218, 218, 0.8)";
        this.ctx.fillRect(scaleOffset - 2, index - 2*scaleOffset, width, 3.5*scaleOffset);
        this.ctx.fillStyle = "white";
        this.ctx.fillText(freq + ' Hz', scaleOffset, index+scaleOffset/2);


      }
      // Draw Circle for point
    const startingAngle = 0;
    const endingAngle = 2 * Math.PI;
    const radius = 10;
    const color = 'rgb(255, 255, 0)';
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, startingAngle, endingAngle);
    this.ctx.fillStyle = color;
    this.ctx.fill();
    this.ctx.stroke();
    }

  }

  drawPitchBendButton(buttonClicked){
    if(buttonClicked){
      this.ctx.fillStyle = "#1c9fdb";
    } else {
      this.ctx.fillStyle = "#56caff";
    }
    const x = 40;
    const y = this.context.state.height - this.context.state.height * 0.15;
    const width = this.context.state.width * 0.05;
    const height = width;
    const arcsize = 25;
    this.ctx.beginPath();
    this.ctx.moveTo(x+arcsize, y);
    this.ctx.lineTo(x+width-arcsize, y);
    this.ctx.arcTo(x+width, y, x+width, y+arcsize, arcsize);
    this.ctx.lineTo(x+width,y+height-arcsize);
    this.ctx.arcTo(x+width, y+height, x+width-arcsize, y+height, arcsize);
    this.ctx.lineTo(x+arcsize, y+height);
    this.ctx.arcTo(x, y+height, x, y-arcsize, arcsize);
    this.ctx.lineTo(x, y+arcsize);
    this.ctx.arcTo(x, y, x+arcsize, y, arcsize);
    this.ctx.lineTo(x+arcsize, y);
    this.ctx.stroke();
    this.ctx.fill();
  }

  isPitchButton(x, y){
    let {height, width} = this.context.state;
    let condition1 = x >= 30 && x <=  width * 0.05 + 30;
    let condition2 = y >= height - height * 0.15 && y <= width * 0.05 +
      height - height * 0.15;
    if(condition1 && condition2){
      return true;
    }
    return false;
  }

  renderNoteLines(){
    let {height, width, resolutionMax, resolutionMin} = this.context.state;
    // this.ctx.clearRect(0, 0, width, height);
    // this.ctx.fillStyle = 'white';

    //  Maps to one of the 12 keys of the piano based on note and accidental
    let newIndexedKey = this.context.state.musicKey.value;
    // Edge cases
    if (newIndexedKey === 0 && this.context.state.accidental.value === 2) {
      // Cb->B
      newIndexedKey = 11;
    } else if (newIndexedKey === 11 && this.context.state.accidental.value === 1) {
      // B#->C
      newIndexedKey = 0;
    } else {
      newIndexedKey = (this.context.state.accidental.value === 1)
        ? newIndexedKey + 1
        : (this.context.state.accidental.value === 2)
          ? newIndexedKey - 1
          : newIndexedKey;
    }

    this.frequencies = {};
    // Uses generateScale helper method to generate base frequency values
    let s = generateScale(newIndexedKey, this.context.state.scale.value);
    //Sweeps through scale object and draws frequency
    for (let i = 0; i < s.scale.length; i++) {
      let freq = s.scale[i];

      for (let j = 0; j < 15; j++) {
        if (freq > resolutionMax) {
          break;
        } else {
          let name = s.scaleNames[i]+''+j;
          let index = freqToIndex(freq, resolutionMax, resolutionMin, height);
          this.frequencies[name] = freq;

          if(this.goldIndices.includes(index) && this.context.state.soundOn){
            this.ctx.fillStyle = 'gold';
          } else if(s.scaleNames[i] === s.scaleNames[0]){
            this.ctx.fillStyle = '#ABE2FB';
          }
          else {
            this.ctx.fillStyle = 'white';
          }
          this.ctx.fillRect(0, index, width, 1);
          freq = freq * 2;
        }
      }
    }

  }

  removeNoteLines(){
      this.ctx.clearRect(0, 0, this.context.state.width, this.context.state.height);
  }

  render() {
    return (
      <MyContext.Consumer>
      {(context) => (
        <canvas
        className="osc-canvas"
        onContextMenu={(e) => e.preventDefault()}
        onMouseDown={this.onMouseDown}
        onMouseUp={this.onMouseUp}
        onMouseMove={this.onMouseMove}
        onMouseOut={this.onMouseOut}
        onTouchStart={this.onTouchStart}
        onTouchEnd={this.onTouchEnd}
        onTouchMove={this.onTouchMove}
        width={context.state.width}
        height={context.state.height}
        ref={(c) => {this.canvas = c;}}/>
      )}
    </MyContext.Consumer>
    )
  }
}

SoundMaking.contextType = MyContext;
export default SoundMaking;