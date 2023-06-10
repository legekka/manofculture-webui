# Man of Culture WebUI
*or just MoC-webui in short*

| ![preview-1](https://legekka.fs.boltz.hu/yfb8i4.png) | ![preview-2](https://legekka.fs.boltz.hu/9au58c.png) |
| ---------------------------------------------------- | ---------------------------------------------------- |
| ![preview-3](https://legekka.fs.boltz.hu/dt5lnd.png) | ![preview-4](https://legekka.fs.boltz.hu/finof4.png) |

## About
This is a webui for the [Man Of Culture bot](https://github.com/legekka/manofculture), and [AI systems](https://github.com/legekka/ai-backend). Main purpose is to provide an accessible web interface for the users to manage their datasets, and get informations about the bot and their personal models.

## Deployment
To deploy the webapp, you'll need Node.js and npm installed. You can install the npm dependencies with `npm install`.

You have to create a `.env` file in the root directory of the project, and fill it with the following variables:
```
CLIENT_ID= <Discord bot client ID>
CLIENT_SECRET= <Discord bot client secret>
COOKIE_SECRET= <any secret string for the cookie parser>
API_URL= <ai-backend api url>
PUBLIC_URL= <public url of the webapp>
APP_URL=http://localhost
APP_PORT=3000
```

After that, you can start the webapp with `node app.js` or `npm run dev` for development.

## License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Credits
Thanks to ExModify, bluewolffy, Akko, olteR, Spkz, and everyone else who helped me with testing the webapp.