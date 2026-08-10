// moment ships locale files without their own type declarations, so a
// side-effect import (`import 'moment/locale/es'`) trips TS2882 under
// moduleResolution: bundler. Declare it as a side-effect-only module.
declare module 'moment/locale/es'
