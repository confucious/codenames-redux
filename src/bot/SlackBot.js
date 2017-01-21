import Bot from './Bot';
import ExtendableError from 'es6-error';
import { codeblock } from './views';

class RequiresChannelError extends ExtendableError {}

export const SLACK_RESPOND_REGEX = /codenames(.*)/;

function fmtChannel(channelName) {
  if (channelName[0] === '#') return channelName;
  return `#${channelName}`;
}

function fmtUsername(userName) {
  if (userName[0] === '@') return userName;
  return `@${userName}`;
}

export default class SlackBot extends Bot {
  constructor(slackbot) {
    super();
    this.robot = slackbot;
    this.listener = this.listener.bind(this)
  }

  listener(req, res) {
    console.log(`recieved message in ${req.to.name} (${req.to.type}) from ${req.from.name}`);
    this.run(req, res);
  }

  channelOf(req) {
    if (req.to.type !== 'channel') return null;
    return fmtChannel(req.to.name);
  }

  usernameOf(req) {
    return fmtUsername(req.from.name);
  }

  guardChannel(req) {
    const channel = this.channelOf(req);
    if (channel) return channel;

    throw new RequiresChannelError();
  }

  addSlackRobotListener() {
    this.robot.listen(SLACK_RESPOND_REGEX, this.listener);
    this.robot.listen('[cC][nN]', this.listener);
    this.robot.listen('[cC][nN] :words(.+)', this.listener);
  }

  // where the magic happens
  run(req, res) {
    // patch this in to match Hubot API
    res.reply = (text) => {
      res.text(`${this.usernameOf(req)}: ${text}`)
    }

    const unparsedArgs = (req.params.words || '').trim();
    const { name, argv, allArgv } = this.parse(unparsedArgs);
    if (argv) argv.allArgv = allArgv;
    const cmd = this.cmdMap[name];
    const result = { res, cmd, name, argv, successful: false };

    if (argv && this.wantsHelp(argv))  {
      res.text(cmd.renderHelp());
      return result;
    }

    try {
      cmd.handler(argv, req, res)
    } catch (err) {
      res.text(`Error while handling command "${name}":\n${err.toString()}`);
      res.text(`Stack trace from command "${name}":\n${codeblock(err.stack)}`, this.usernameOf(req));
      result.err = err;
      return result;
    }

    result.successful = true;
    return result;
  }
}
