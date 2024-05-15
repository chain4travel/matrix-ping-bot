# matrix-ping-bot

Very easy and straightforward implementation of a ping-pong bot measuring performance figures for matrix servers. Tested and working with locally running single instance of synapse, dendrite and conduit.

How to run:
`npm install`

How to register:
First you need to start matrix server. You will find docker-compose.yml files in matrix-ping-bot/matrix-servers. The configuration files for each server type are configured to run on localhost.

To run the server:
`cd matrix-servers/synapse && docker compose up`

To register the bots:
`npm run register [config_filename] [homeserver ip/domain] [homeserver type (default: synapse)]`
Example:
`npm run register config_synapse localhost synapse`

This will create a configuration file which might look like this:

```json
{
        "pingbot": {
                "username": "pingbot_819dfbd8",
                "token": "syt_cGluZ2JvdF84MTlkZmJkOA_jNudsYEJNwJsbtapfvxB_1ZLvtu",
                "password": "8ea87ce48b979919f47f"
        },
        "pongbot": {
                "username": "pongbot_819dfbd8",
                "token": "syt_cG9uZ2JvdF84MTlkZmJkOA_HOghvnrGDSEAGIjmTbah_4agU6Z",
                "password": "575d20f61bc0ad6f3ba0"
        },
        "hs_proto": "http",
        "hs_host": "localhost",
        "hs_port": 8008,
        "hs_type": "synapse"
}
```

The sessions ping and pong will not use the password from that point on but only the token to login. This is only for convenience if someone wants to login with the account manually.

The actual two different sessions are started with:
`npm run ping [config_filename]`
and
`npm run pong [config_filename]`

The bots can be invited to any room and will automatically join. Once invited type `help` in the channel which will bring up the list of commands.
