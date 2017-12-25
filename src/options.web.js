import React from 'react';
import ReactDOM from 'react-dom';

import browser from 'webextension-polyfill';

import MatchItem from './MatchItem';

class Popup extends React.Component {
  constructor(props) {
    super(props);
    this.state = {items: [{regex: '', pubkey: ''}]};
    this.onItemChange = this.onItemChange.bind(this);
    this.addItem = this.addItem.bind(this);
    this.deleteItem = this.deleteItem.bind(this);
    this.saveChanges = this.saveChanges.bind(this);
  }

  componentDidMount() {
    browser.storage.local.get('items').then((result) => this.setState({items: result.items || []}));
  }

  onItemChange(itemKey, name, value) {
    this.setState((prevState) => {
      let items = prevState.items.slice(0);
      items[itemKey] = Object.assign({}, items[itemKey], {[name]: value});
      return Object.assign({}, prevState, {changed: true, items});
    });
  }

  addItem() {
    this.setState((prevState) => {
      let items = prevState.items.slice(0);
      items.push({regex: '', pubkey: ''});
      return Object.assign({}, prevState, {changed: true, items});
    });
  }

  deleteItem(itemKey) {
    this.setState((prevState) => {
      let items = prevState.items.slice(0);
      items.splice(itemKey, 1);
      return Object.assign({}, prevState, {changed: true, items});
    });
  }

  saveChanges() {
    browser.storage.local.set({ items: this.state.items });
    this.setState({changed: false});
  }

  render() {
    return (
      <div>
        <h1>Websites and Keys</h1>
        <p>
          Each entry is a regular expression to match a URL with, and the corresponding expected public key.
        </p>
        <div>
          {this.state.items.map((item, idx) => (
            <React.Fragment>
              <MatchItem key={idx} itemKey={idx} regex={item.regex} pubkey={item.pubkey} onInputChange={this.onItemChange} onDeleteRequest={this.deleteItem} />
              <hr />
            </React.Fragment>
          ))}
        </div>
        <div style={{textAlign: 'right'}}>
          <button onClick={this.addItem}>Add item</button>
          <button style={{marginLeft: 30}} disabled={!this.state.changed} onClick={this.saveChanges}>Save Changes</button>
        </div>
      </div>
    );
  }
}

ReactDOM.render(<Popup/>, document.getElementById('app'));
