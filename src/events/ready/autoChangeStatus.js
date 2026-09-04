const fs = require('fs')
const {
  statusMessageEdit,
  setOfflineEmbed,
  consoleLogTranslation,
  getError,
  removeUnusedEmojis,
} = require('../../index.js')
const chalk = require('chalk')
const config = require('../../../config.js')

const CONSECUTIVE_FAILURES_TO_OFFLINE = 2
const CONSECUTIVE_SUCCESSES_TO_ONLINE = 2
const cardStates = {}

const getCardState = (key) => {
  if (!cardStates[key]) {
    cardStates[key] = { online: true, failures: 0, successes: 0 }
  }
  return cardStates[key]
}

module.exports = async (client) => {
  if (!config.autoChangeStatus.enabled) return
  try {
    const autoChangeStatus = async () => {
      let dataRead = JSON.parse(fs.readFileSync(`${__dirname}/../../data.json`, 'utf8'))
      let messagesIdArray = []
      try {
        for (const value of dataRead.autoChangeStatus) {
          const channel = await client.channels.fetch(value.channelId)
          const message = await channel.messages.fetch(value.messageId)
          const key = `${value.channelId}-${value.messageId}`
          const state = getCardState(key)
          const probe = await statusMessageEdit(
            value.ip,
            value.port,
            value.type,
            value.name,
            message,
            value.isPlayerAvatarEmoji,
            state.online
          )

          if (probe) {
            state.failures = 0
            if (state.online) {
              state.successes = 0
            } else {
              state.successes += 1
              if (state.successes >= CONSECUTIVE_SUCCESSES_TO_ONLINE) {
                state.online = true
                state.successes = 0
                await statusMessageEdit(
                  value.ip,
                  value.port,
                  value.type,
                  value.name,
                  message,
                  value.isPlayerAvatarEmoji,
                  true
                )
              }
            }
          } else {
            state.successes = 0
            state.failures += 1
            if (state.online && state.failures >= CONSECUTIVE_FAILURES_TO_OFFLINE) {
              state.online = false
              state.failures = 0
              await setOfflineEmbed(message)
            }
          }

          messagesIdArray.push(value)
        }
        removeUnusedEmojis()
      } catch (error) {
        if (error.rawError?.message === 'Unknown Message') return
        getError(error, 'messageEdit')
      } finally {
        dataRead.autoChangeStatus = messagesIdArray
        fs.writeFileSync('./src/data.json', JSON.stringify(dataRead, null, 2), 'utf8')
      }
    }
    const data = require('../../data.json')
    if (data.autoChangeStatus.length === 0) {
      console.log(
        consoleLogTranslation.debug.autoChangeStatus.enableAutoChangeStatus.replace(
          /\{cmd\}/gi,
          chalk.cyan('"/setstatus"')
        )
      )
    } else {
      autoChangeStatus()
      setInterval(autoChangeStatus, config.autoChangeStatus.updateInterval * 1000)
    }
  } catch (error) {
    getError(error, 'channelIdCheck')
  }
}
