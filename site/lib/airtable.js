// uriEncode but not

export const cleanString = (userInput) => {
  // this is a simple allowlist that I'm starting with. if you wanna add more
  // you can, just keep in mind that any "'{} & other special characters used as
  // airtable functions SHOULD NOT BE ALLOWED in here
  return userInput.match(/[a-zA-Z0-9@#$%^&+_\-=]/g)?.join('') || ''
}

// bringing over from https://github.com/hackclub/adventure-time/pull/17/files#diff-0334d77079cb1e28047780cc0ca1ca84e393b1b621c5f5ef410d4b0f6f081df8R1-R6