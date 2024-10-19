import { $ } from 'bun'

// Commands to sync the local codegen folder with the fly and render volumes

async function pullFly() {
  try {
    await $`rm -rf ./codegen && mkdir -p ./codegen`
    await $`fly ssh console -C 'tar -czf /tmp/codegen_backup.tar.gz -C /app/codegen .'`
    await $`fly sftp get /tmp/codegen_backup.tar.gz ./local_codegen_backup.tar.gz`
    await $`tar -xzf ./local_codegen_backup.tar.gz -C ./codegen`
    await $`rm ./local_codegen_backup.tar.gz`
    console.log('Fly volume pulled successfully')
  } catch (error) {
    console.error('Error pulling Fly volume:', error)
  }
}

async function pushFly() {
  try {
    await $`tar -czf ./codegen_backup.tar.gz -C ./codegen .`
    await $`expect -c 'spawn fly ssh sftp shell; expect "»"; send "put ./codegen_backup.tar.gz /tmp/codegen_backup.tar.gz\r"; expect "»"; send "\x03"; expect eof'`
    await $`expect -c 'spawn fly ssh console; expect "#"; send "find /app/codegen -mindepth 1 -delete\r"; expect "#"; send "tar -xzf /tmp/codegen_backup.tar.gz -C /app/codegen\r"; expect "#"; send "rm /tmp/codegen_backup.tar.gz\r"; expect "#"; send "exit\r"; expect eof'`
    await $`rm ./codegen_backup.tar.gz`
    console.log('Fly volume pushed successfully')
  } catch (error) {
    console.error('Error pushing Fly volume:', error)
  }
}

async function pullRender() {
  try {
    await $`rm -rf ./codegen && mkdir -p ./codegen`
    await $`ssh srv-cq9kk73v2p9s73ck9jkg@ssh.oregon.render.com 'tar -czf - -C /app/codegen .' | tar -xzf - -C ./codegen`
    console.log('Render volume pulled successfully')
  } catch (error) {
    console.error('Error pulling Render volume:', error)
  }
}

async function pushRender() {
  try {
    await $`tar -czf - -C ./codegen . | ssh srv-cq9kk73v2p9s73ck9jkg@ssh.oregon.render.com 'rm -rf /app/codegen/* && tar -xzf - -C /app/codegen'`
    console.log('Render volume pushed successfully')
  } catch (error) {
    console.error('Error pushing Render volume:', error)
  }
}

async function pushAll() {
  await pushFly()
  await pushRender()
}

if (import.meta.main) {
  const command = process.argv[2]
  const commands = {
    'pull:fly': pullFly,
    'pull:render': pullRender,
    'push:fly': pushFly,
    'push:render': pushRender,
    'push:all': pushAll,
  }

  if (!(command in commands)) {
    console.error(
      'Invalid command. Valid commands:\n' +
        Object.keys(commands)
          .map((command) => `  - ${command}`)
          .join('\n')
    )
    process.exit(1)
  }

  await commands[command as keyof typeof commands]()
}
