// The date picker binds a native module at import; jest can't provide it and no
// test drives the picker, so a no-op component keeps the import resolvable.
module.exports = { __esModule: true, default: () => null };
