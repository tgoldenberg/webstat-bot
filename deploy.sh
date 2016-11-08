nvm use 6.0.0
source env_settings.sh
forever stop "slack"
forever start --uid "slack" -a -l ~/logs/bot.log index.js
