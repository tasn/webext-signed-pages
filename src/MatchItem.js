import React from 'react';

export default class MatchItem extends React.PureComponent {

  constructor(props) {
    super(props);

    this.handleInputChange = this.handleInputChange.bind(this);
  }

  handleInputChange(event) {
    const name = event.target.name;
    const value = event.target.value;
    this.props.onInputChange(this.props.itemKey, name, value);
  }

  render() {
    const style = {
      fullWidth: {
        width: '100%',
        boxSizing: 'border-box',
      },
    };

    return (
      <div>
        <label>URL Match: </label>
        <input
          type="text"
          name="regex"
          placeholder="https?://example.com/secure/.*"
          style={style.fullWidth}
          value={this.props.regex}
          onChange={this.handleInputChange}
        />
        <br/>
        <label>Public Key: </label>
        <textarea
          name="pubkey"
          placeholder="-----BEGIN PGP PUBLIC KEY BLOCK----- ..."
          style={style.fullWidth}
          value={this.props.pubkey}
          onChange={this.handleInputChange}
        />
        <button onClick={() => this.props.onDeleteRequest(this.props.itemKey)}>Remove item</button>
      </div>
    );
  }
}
