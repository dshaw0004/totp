export default function ManualEntryScreen() {
  return (
    <box justifyContent="center" alignItems="center" flexGrow={1}>
    <box title="Add New" borderStyle='rounded' borderColor={'yellow'}>
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
        <input placeholder='Enter secret...' />
      </box>
    </box>
</box>
  )
}
