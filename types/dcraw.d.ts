// types/dcraw.d.ts
declare module 'dcraw' {
  interface DcrawResult {
    files: {
      [filename: string]: Buffer;
    };
  }
  function dcraw(input: Buffer, options: { exportAsTiff: boolean }): DcrawResult;
  export = dcraw;
}
