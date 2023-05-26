require('dotenv').config();

const express = require('express');
const axios = require('axios');
const cookieParser = require('cookie-parser');
const ejs = require('ejs');

const app = express();
const port = 3000;

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const COOKIE_SECRET = process.env.COOKIE_SECRET;
const API_URL = process.env.API_URL;

app.use(cookieParser(COOKIE_SECRET));
app.use(express.static('./assets'));
app.use(express.static('./assets/fonts'));
app.use(express.static('./assets/images'));
app.use(express.json());

app.get('/', async (req, res) => {
  if (!req.signedCookies.login) {
    return res.redirect('/auth');
  }

  const user = req.signedCookies.username;
  const ratingData = await axios.get(`${ API_URL }/getuserdata?user=${ user }`);
  const convertedData = [];
  const images = [];
  const ratings = [];

  for (const key in ratingData.data) {
    const item = ratingData.data[key];
    const image = `/getimage?filename=${ item.image }`;

    images.push(image);
    ratings.push(item.rating);
    convertedData.push({ image: image, rating: item.rating });
  }

  ejs.renderFile('./assets/pages/booru.ejs', { data: JSON.stringify(convertedData), images: images, ratings: ratings }, (err, bodyContent) => {
    if (err) {
      console.log('Error: ', err);
      return res.send('Some error occurred!');
    }

    ejs.renderFile('./assets/index.ejs', { page: bodyContent }, (err, html) => {
      if (err) {
        console.log('Error: ', err);
        return res.send('Some error occurred!');
      }

      return res.send(html);
    });
  });
});

app.get('/auth', (req, res) => {
  const redirectUri = encodeURIComponent(`http://localhost:${ port }/auth/discord`);

  res.send(`
    <div style="margin: 300px auto;
         max-width: 400px;
         display: flex;
         flex-direction: column;
         align-items: center;
         font-family: sans-serif;"
    >
      <h3>Welcome to Discord OAuth NodeJS App</h3>
      <p>Click on the below button to get started!</p>
      <a href="https://discord.com/api/oauth2/authorize?client_id=${ CLIENT_ID }&redirect_uri=${ redirectUri }&response_type=code&scope=identify%20email"
         style="outline: none;
         padding: 10px;
         border: none;
         font-size: 20px;
         margin-top: 20px;
         border-radius: 8px;
         background: #6D81CD;
         cursor:pointer;
         text-decoration: none;
         color: white;"
      >
        Login with Discord
      </a>
    </div>
  `)
});

app.get('/auth/discord', async(req, res) => {
  const code = req.query.code;
  const params = new URLSearchParams();

  params.append('client_id', CLIENT_ID);
  params.append('client_secret', CLIENT_SECRET);
  params.append('grant_type', 'authorization_code');
  params.append('code', code);
  params.append('redirect_uri', `http://localhost:${ port }/auth/discord`);

  try {
      const response = await axios.post('https://discord.com/api/oauth2/token', params);
      const { 
        access_token,
        token_type
      } = response.data;

      const userDataResponse = await axios.get('https://discord.com/api/users/@me', {
        headers: {
          authorization: `${ token_type } ${ access_token }`
        }
      });

      const user = {
        username: userDataResponse.data.username
      }

      const expirationDuration = 3 * 24 * 60 * 60 * 1000; // 3 day

      res.cookie('login', true, {
        signed: true,
        maxAge: expirationDuration
      });

      res.cookie('username', user.username, {
        signed: true,
        maxAge: expirationDuration
      });

      return res.redirect('/');
  } catch (error) {
    console.log('Error', error);
    return res.send('Some error occurred!');
  } 
});

app.get('/getimage', async (req, res) => {
  const filename = req.query.filename;
  const image = await axios.get(`${ API_URL }/getimage?filename=${ filename }`, { responseType: 'arraybuffer' });

  return res.send(image.data);
});

app.get('/gettags', async (req, res) => {
  const filename = req.query.filename;
  const tags = await axios.get(`${ API_URL }/getimagetags?filename=${ filename }`);

  return res.send(tags.data);
});

app.post('/updaterating', async (req, res) => {
  const filename = req.body.filename;
  const rating = req.body.rating;
  const user = req.signedCookies.username;

  try {
    await axios.post(`${ API_URL }/updaterating`, { filename: filename, rating: rating, user: user });
    return res.status(200).send({ success: true });
  } catch (error) {
    console.log('Error', error);
    return res.status(400).send({ error: 'Some error occurred!' });
  }
});

app.get('/getfilteredimages', async (req, res) => {
  const filters = req.query.tags;
  const user = req.signedCookies.username;

  try {
    const images = await axios.get(`${ API_URL }/getuserdata?user=${ user }&filters=${ filters }`);
    return res.status(200).send(images.data);
  } catch (error) {
    console.log('Error', error);
    return res.status(400).send({ error: 'Some error occurred!' });
  }
});

app.listen(port, () => {
  console.log(`App listening at http://localhost:${ port }`);
});