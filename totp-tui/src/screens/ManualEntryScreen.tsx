import { useState } from "react"
export default function ManualEntryScreen() {
  const [secret, setSecret] = useState<string>('')
  return (
    <box flexGrow={2} borderStyle='rounded' title="Add New Account" titleAlignment='left' borderColor={'green'} justifyContent="center" alignItems="center">
      <box borderStyle='rounded' borderColor={'yellow'}>
        <box flexDirection="row">
          <text>Name: </text>
          <input placeholder='Enter name...' />
        </box>
        <box flexDirection="row">
          <text>Issuer: </text>
          <input placeholder='Enter issuer...' />
        </box>
        <box flexDirection="row">
          <text>Secret: </text>
          <input
            placeholder='Enter secret...'
            value={secret}
            onChange={(value) => setSecret(value)}
          />
        </box>
      </box>
    </box>
  )
}
