import { $ } from 'bun'

// Commands to sync the local codegen folder with the fly and render volumes

async function pullFly() {
  await $`rm -rf ./codegen && mkdir -p ./codegen`
  await $`fly ssh console -C 'tar -czf /tmp/codegen_backup.tar.gz -C /app/codegen .'`
  await $`fly sftp get /tmp/codegen_backup.tar.gz ./local_codegen_backup.tar.gz`
  await $`tar -xzf ./local_codegen_backup.tar.gz -C ./codegen`
  await $`rm ./local_codegen_backup.tar.gz`
  console.log('Fly volume pulled successfully')
}

async function pushFly() {
  await $`tar -czf ./codegen_backup.tar.gz -C ./codegen .`
  await $`expect -c 'spawn fly ssh sftp shell; expect "»"; send "put ./codegen_backup.tar.gz /tmp/codegen_backup.tar.gz\r"; expect "»"; send "\x03"; expect eof'`
  await $`expect -c 'spawn fly ssh console; expect "#"; send "find /app/codegen -mindepth 1 -delete\r"; expect "#"; send "tar -xzf /tmp/codegen_backup.tar.gz -C /app/codegen\r"; expect "#"; send "rm /tmp/codegen_backup.tar.gz\r"; expect "#"; send "exit\r"; expect eof'`
  await $`rm ./codegen_backup.tar.gz`
  console.log('Fly volume pushed successfully')
}

async function pullRender() {
  await $`rm -rf ./codegen && mkdir -p ./codegen`
  await $`ssh srv-cq9kk73v2p9s73ck9jkg@ssh.oregon.render.com 'tar -czf - -C /app/codegen .' | tar -xzf - -C ./codegen`
  console.log('Render volume pulled successfully')
}

async function pushRender() {
  await $`tar -czf - -C ./codegen . | ssh srv-cq9kk73v2p9s73ck9jkg@ssh.oregon.render.com 'rm -rf /app/codegen/* && tar -xzf - -C /app/codegen'`
  console.log('Render volume pushed successfully')
}

// Just bundle codegen into a tar. Name it codegen_<timestamp>.tar.gz
async function backup() {
  const timestamp = new Date().toISOString().slice(0, 16)
  const filename = `./backup/codegen_${timestamp}.tar.gz`
  await $`tar -czf ${filename} -C ./codegen .`
  console.log(`Codegen backed up to ${filename}`)
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
    backup,
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
