import { TextAttributes } from "@opentui/core";

export default function WelcomeScreen() {
  return (
    <box flexGrow={1} justifyContent="center" alignItems="center" borderStyle='rounded' borderColor={'yellow'}>
      <ascii-font font='tiny' text='Welcome to'/>
      <ascii-font font='block' marginTop={2} marginBottom={1} text='totp' />
      <text attributes={TextAttributes.DIM}>Authenticator for terminal users</text>
    </box>
  );
}
