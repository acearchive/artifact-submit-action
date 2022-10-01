import stream from "stream";

export const pipeAsync = async (
  input: stream.Readable,
  output: stream.Writable
): Promise<void> => {
  return new Promise((resolve, reject) => {
    input.pipe(output).on("finish", resolve).on("error", reject);
  });
};
