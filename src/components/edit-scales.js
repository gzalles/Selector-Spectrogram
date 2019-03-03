import React, {Component} from 'react';
import {Button, Icon, Form, Segment, Menu, Input, Radio} from 'semantic-ui-react';
import {MyContext} from './my-provider';

import "../styles/edit-scales.css";
import 'rc-slider/assets/index.css';

import Range from 'rc-slider/lib/Range';

import generateScale from '../util/generateScale';

const NUM_TONES = 12;
// Class the renders the Edit Scales when the button is pushed
class EditScales extends Component {
  constructor(){
    super();
    this.state = {
      scale: [false,false,false,false,false,false,false,false,false,false,false,false],
      scaleValue: ""
    }
  }

  componentDidMount(){
    this.regenerateScale();
  }

  regenerateScale(){
    if(this.context.state.scale.name !== "Custom" && this.context.state.scale.value !== this.state.scaleValue){
      let s = generateScale(0, this.context.state.scale.value);
      let scale = [];
      for(let i = 0; i <s.scalePattern.length; i++){
        scale[s.scalePattern[i]] = true;
      }
      this.setState({scale: scale, scaleValue: this.context.state.scale.value});
    }
  }

  handleScaleToggle(i){
    let scale = this.state.scale;
    scale[i] = !scale[i];
    this.setState({scale: scale});
    let s = [];
    for(let i = 0; i < scale.length; i++){
      if(scale[i]){
        s.push(i);
      }
    }
    this.context.handleScaleEdit({name: "Custom" });
    this.setState({scaleValue: "Custom"});
  }

  renderDegrees(){
    this.regenerateScale();
    var notes = [];
    let className;
    for (let i = 0; i < NUM_TONES; i++) {
      if(this.state.scale[i]){
        className = "note activeNote";
      } else {
        className = "note";
      }

      notes.push(<span className={className} key={i} onClick={()=>this.handleScaleToggle(i)}> {i+1} </span>);
    }
    return notes;
  }

  render(){
    return (
      <MyContext.Consumer>
        {(context) => (
          <React.Fragment>
            <Segment className="menu-pane-container compact edit-scales-container">
            {this.renderDegrees()}
            </Segment>
          </React.Fragment>
        )}
      </MyContext.Consumer>

    );
  }

}
EditScales.contextType = MyContext;
export default EditScales;
