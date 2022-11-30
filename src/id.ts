const lowerAlphaPool = "abcdefghijklmnopqrstuvwxyz";
const upperAlphaPool = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const numberPool = "0123456789";
const artifactIdPool = lowerAlphaPool + upperAlphaPool + numberPool;

export const artifactIdLength = 12;

// This random ID DOES NOT need to be cryptographically secure. It only needs to
// be reasonably collision-resistant.
export const newRandomArtifactID = (): string => {
  let artifactId = "";

  for (let i = 0; i < artifactIdLength; i++) {
    const randomNum = Math.floor(Math.random() * artifactIdPool.length);
    artifactId += artifactIdPool[randomNum];
  }

  return artifactId;
};
