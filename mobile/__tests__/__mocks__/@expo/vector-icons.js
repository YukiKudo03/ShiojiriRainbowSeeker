const React = require('react');

const createIconMock = (name) => {
  const Icon = (props) => React.createElement('Text', { ...props, testID: props.testID || `icon-${name}` }, props.name || '');
  Icon.glyphMap = {};
  return Icon;
};

module.exports = {
  Ionicons: createIconMock('Ionicons'),
  MaterialIcons: createIconMock('MaterialIcons'),
  FontAwesome: createIconMock('FontAwesome'),
  Feather: createIconMock('Feather'),
  AntDesign: createIconMock('AntDesign'),
};
