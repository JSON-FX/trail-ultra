// Manual jest mock. lucide-react-native ships ESM (.mjs) that jest-expo's
// transform pipeline does not process (only .[jt]sx? files go through
// babel-jest), so importing a real icon throws "Unexpected token 'export'".
// Stub every icon as a prop-passing View so components/screens that render
// <Icon as={SomeIcon} testID=... /> work under jest. Metro transforms the real
// package fine on-device, so this only affects the test environment.
const React = require("react");
const { View } = require("react-native");

module.exports = new Proxy(
  { __esModule: true },
  {
    get(target, prop) {
      if (prop in target) return target[prop];
      const Stub = (props) => React.createElement(View, props);
      Stub.displayName = String(prop);
      return Stub;
    },
  }
);
