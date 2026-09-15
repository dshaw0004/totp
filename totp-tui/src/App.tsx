import {useEffect, useState} from 'react';
import {decodePasteBytes, red, type KeyEvent, type PasteEvent, type Selection} from "@opentui/core";
import {useRenderer, useKeyboard, usePaste, useFocus, useBlur, useSelectionHandler} from "@opentui/react";
import {accounts, getAccountById, type FullAccount} from './db';
import WelcomeScreen from './screens/WelcomeScreen';
import { totp } from './lib/otp';
import ManualEntryScreen from './screens/ManualEntryScreen';

export default function App() {
  // const [showConsole, setShowConsole] = useState<Boolean>(false);
  const [selectedScreen, setSelectedScreen] = useState<'welcome' | 'main' | 'manual_entry'>('welcome');
  const [selectedAccountId, setSelectedAccountId] = useState<Number>(0);
  const [selectedAccount, setSelectedAccount] = useState<FullAccount | null>(null);
  const [selectedAccountCode, setSelectedAccountCode] = useState<number>(0);
  const renderer = useRenderer();
  useKeyboard((key: KeyEvent) => {
    if (key.name == "q") {
      renderer.destroy();
    } else if (key.name == '/' && key.ctrl) {
      // setShowConsole((prev: Boolean) => !prev)
      renderer.console.toggle()
    } else if (key.name == '+') {
      setSelectedScreen('manual_entry')
    } else if (key.name == 'Esc') {
         setSelectedScreen('main')
       }
  })
  // usePaste((event: PasteEvent) => {
  //   const text = decodePasteBytes(event.bytes);
  //   renderer.console.hide()
  //   console.log(text)
  // })
  // useFocus(() => {console.log('got focused')})
  // useBlur(() => {console.log('lost focus')})
  // useSelectionHandler((selection: Selection) => {
  //   const text = selection.getSelectedText()
  //   console.log('selected: ', text)
  // })



  // useEffect(() => {
  //   if (showConsole) {
  //     renderer.console.show()
  //   } else {renderer.console.hide()}
  // }, [showConsole])
  useEffect(() => {
    if (!selectedAccountId) {
      return
    }
    const account = getAccountById(selectedAccountId)
    setSelectedAccount(account);
    account?.secret_b32 &&(async function () {
      const otp = await totp(account.secret_b32)
      setSelectedAccountCode(otp)
    })()
  },[selectedAccountId])
  useEffect(() => {
    if (accounts && accounts[0]) {
      setSelectedAccountId(accounts[0].id)
    }
    let timeout = setTimeout(() => {
      setSelectedScreen('main');
    }, 1500)
    return () => {
      clearTimeout(timeout)
    }
  }, [])

  if (selectedScreen === 'welcome') {
    return (
      <box flexGrow={1}>
        <WelcomeScreen />
      </box>
    );
  }
  return (
    <box flexGrow={1} flexDirection='row'>
      <box flexGrow={1} borderStyle='rounded' title="Menu" titleAlignment='left' borderColor={'green'}>
        <select
          options={[{
            name: 'Home',
            description: 'Home',
            value: 'main',
          },
          {
            name: 'New',
            description: 'add new',
            value: 'manual_entry',
          }]}
          onChange={(_index, option) => setSelectedScreen(option?.value || 'main')}
          minWidth={16}
          flexGrow={1}
          flexBasis={0}
        />
      </box>
      {
        selectedScreen === 'manual_entry' ? (
          <ManualEntryScreen />
        ) : (
          <box flexGrow={2}>
            <box borderStyle='rounded' flexGrow={2} title="Accounts" titleAlignment='left' borderColor={'green'}>
              <select
                focused={true}
                options={accounts.map(a => ({name: a.name, description: a.issuer, value: a.id}))}
                onChange={(_index, option) => setSelectedAccountId(option?.value || 0)}
                onSelect={(params) => console.log(params)}
                flexGrow={1}
                flexBasis={0}
              />
            </box>
            <box borderStyle='rounded' flexGrow={2} borderColor={'green'}>
              {
                (!!selectedAccountId && !!selectedAccount) ? (<>
                    <text>Name: { selectedAccount.name}</text>
                    <text>Issuer: { selectedAccount.issuer}</text>
                    <text>Time left: 30s</text>
                    <text>Code: {selectedAccountCode}</text>
                </>)
                  : (
                    <box flexGrow={1} justifyContent='center' alignItems='center'>
                      <text>Please Select an account</text>
                    </box>
                  )
              }
            </box>
          </box>
        )
      }
    </box>
  );
}
