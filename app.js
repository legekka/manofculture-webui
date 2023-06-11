/* --- .env --- */
require('dotenv').config();

/* --- .env variables --- */
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const COOKIE_SECRET = process.env.COOKIE_SECRET;
const API_URL = process.env.API_URL;
const APP_URL = process.env.APP_URL;
const APP_PORT = process.env.APP_PORT;
const PUBLIC_URL = process.env.PUBLIC_URL;

/* --- Reqs --- */
const express = require('express');
const axios = require('axios');
const cookieParser = require('cookie-parser');
const ejs = require('ejs');
const multer = require('multer');
const FormData = require('form-data');

/* --- Global consts --- */
const app = express();
const upload = multer();
const fullAppUrl = `${ APP_URL }${ typeof APP_PORT !== 'undefined' ? `:${ APP_PORT }` : '' }`;

/* --- Express packages --- */
app.use(cookieParser(COOKIE_SECRET));
app.use(express.static('./assets'));
app.use(express.static('./assets/libs'));
app.use(express.static('./assets/fonts'));
app.use(express.static('./assets/images'));
app.use(express.static('./assets/favicon'));
app.use(express.json());

/* --- Main page (After Auth) --- */
app.get('/', async (req, res) => {
  if (!req.signedCookies.userId) {
    return res.redirect('/auth');
  }

  const user = {
    userName: req.signedCookies.userName,
    avatar: req.signedCookies.avatar
  }

  const currentYear = new Date().getFullYear();

  ejs.renderFile('./assets/pages/booru.ejs', (err, bodyContent) => {
    if (err) {
      console.log('Error: ', err);
      return res.status(400).send('Some error occurred!');
    }

    ejs.renderFile('./assets/index.ejs', { page: bodyContent, user: user, currentYear: currentYear }, (err, html) => {
      if (err) {
        console.log('Error: ', err);
        return res.status(400).send('Some error occurred!');
      }

      return res.status(200).send(html);
    });
  });
});

/* --- Authentication --- */
app.get('/auth', (req, res) => {
  const encodedAppUrl = encodeURIComponent(`${ PUBLIC_URL }/auth/discord`);
  const redirectUri = `https://discord.com/api/oauth2/authorize?client_id=${ CLIENT_ID }&redirect_uri=${ encodedAppUrl }&response_type=code&scope=identify`;

  ejs.renderFile('./assets/pages/auth.ejs', { redirectUri: redirectUri }, (err, bodyContent) => {
    if (err) {
      console.log('Error: ', err);
      return res.status(400).send('Some error occurred!');
    }

    ejs.renderFile('./assets/index.ejs', { page: bodyContent, user: null }, (err, html) => {
      if (err) {
        console.log('Error: ', err);
        return res.status(400).send('Some error occurred!');
      }

      return res.status(200).send(html);
    });
  });
});

app.get('/auth/discord', async(req, res) => {
  const code = req.query.code;
  const params = new URLSearchParams();

  params.append('client_id', CLIENT_ID);
  params.append('client_secret', CLIENT_SECRET);
  params.append('grant_type', 'authorization_code');
  params.append('code', code);
  params.append('redirect_uri', `${ PUBLIC_URL }/auth/discord`);

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

      const discordName = userDataResponse.data.username;
      const discordId = userDataResponse.data.id;

      const user = {
        userName: discordName,
        userId: discordId,
        avatar: `https://cdn.discordapp.com/avatars/${ discordId }/${ userDataResponse.data.avatar }.png`
      }

      const expirationDuration = 3 * 24 * 60 * 60 * 1000; // 3 day

      res.cookie('userName', user.userName, {
        signed: true,
        maxAge: expirationDuration
      });

      res.cookie('userId', user.userId, {
        signed: true,
        maxAge: expirationDuration
      });

      res.cookie('avatar', user.avatar, {
        signed: true,
        maxAge: expirationDuration
      });

      return res.redirect('/');
  } catch (error) {
    console.log('Error', error);
    return res.status(400).send('Some error occurred!');
  } 
});

/* --- Frontend to Backend endpoints --- */
app.get('/getimages', async (req, res) => {
  const user = req.signedCookies.userId;
  const filters = req.query.filters;
  const page = req.query.page;
  const sort = req.query.sort;
  const rated = req.query.rated;

  if (!user) {
    res.redirect('/auth');
  }

  const pageQuery = typeof page !== 'undefined' ? `&page=${ page }` : '';
  const filtersQuery = typeof filters !== 'undefined' ? `&filters=${ filters }` : '';
  const sortQuery = typeof sort !== 'undefined' ? `&sort=${ sort }` : '';
  const ratedQuery = typeof rated !== 'undefined' ? `&rated=${ rated }` : '';

  try {
    const images = await axios.get(`${ API_URL }/getuserdata?user=${ user }${ filtersQuery }${ pageQuery }${ sortQuery }${ ratedQuery }`);
    return res.status(200).send(images.data);
  } catch (error) {
    console.log('Error', error);
    return res.status(400).send({ error: 'Some error occurred!' });
  }
});

app.get('/getimage', async (req, res) => {
  const filename = req.query.filename;

  try {
    const image = await axios.get(`${ API_URL }/getimage?filename=${ filename }`, { responseType: 'arraybuffer' });
    return res.status(200).send(image.data);
  } catch (error) {
    console.log('Error', error);
    return res.status(400).send({ error: 'Some error occurred!' });
  }
});

app.get('/getthumbnail', async (req, res) => {
  const filename = req.query.filename;

  try {
    const image = await axios.get(`${ API_URL }/getthumbnail?filename=${ filename }`, { responseType: 'arraybuffer' });
    return res.status(200).send(image.data);
  } catch (error) {
    console.log('Error', error);
    return res.status(400).send({ error: 'Some error occurred!' });
  }
});

app.get('/gettags', async (req, res) => {
  const filename = req.query.filename;

  try {
    const tags = await axios.get(`${ API_URL }/getimagetags?filename=${ filename }`);
    return res.status(200).send(tags.data);
  } catch (error) {
    console.log('Error', error);
    return res.status(400).send({ error: 'Some error occurred!' });
  }
});

app.get('/getalltags', async (req, res) => {
  try {
    const tags = await axios.get(`${ API_URL }/gettags`);
    return res.status(200).send(tags.data);
  } catch (error) {
    console.log('Error', error);
    return res.status(400).send({ error: 'Some error occurred!' });
  }
});

app.post('/updaterating', async (req, res) => {
  const filename = req.body.filename;
  const rating = req.body.rating;
  const user = req.signedCookies.userId;

  if (!user) {
    res.redirect('/auth');
  }

  try {
    await axios.post(`${ API_URL }/updaterating`, { filename: filename, rating: rating, user: user });
    return res.status(200).send({ success: true });
  } catch (error) {
    console.log('Error', error);
    return res.status(400).send({ error: 'Some error occurred!' });
  }
});

app.get('/getimageneighbours', async (req, res) => {
  const user = req.signedCookies.userId;
  const filename = req.query.filename;
  const filters = req.query.filters;
  const sort = req.query.sort;
  const rated = req.query.rated;

  if (!user) {
    res.redirect('/auth');
  }

  const filtersQuery = typeof filters !== 'undefined' ? `&filters=${ filters }` : '';
  const sortQuery = typeof sort !== 'undefined' ? `&sort=${ sort }` : '';
  const ratedQuery = typeof rated !== 'undefined' ? `&rated=${ rated }` : '';

  try {
    const images = await axios.get(`${ API_URL }/getimageneighbours?filename=${ filename }&user=${ user }${ filtersQuery }${ sortQuery }${ ratedQuery }`);
    return res.status(200).send(images.data);
  } catch (error) {
    console.log('Error', error);
    return res.status(400).send({ error: 'Some error occurred!' });
  }
});

app.get('/getstats', async (req, res) => {
  const user = req.signedCookies.userId;

  if (!user) {
    res.redirect('/auth');
  }
  
  try {
    const stats = await axios.get(`${ API_URL }/getstats?user=${ user }`);
    return res.status(200).send(stats.data);
  } catch (error) {
    console.log('Error', error);
    return res.status(400).send({ error: 'Some error occurred!' });
  }
});

app.get('/removerating', async(req, res) => {
  const filename = req.query.filename;
  const user = req.signedCookies.userId;

  if (!user) {
    res.redirect('/auth');
  }

  try {
    await axios.get(`${ API_URL }/removerating?user=${ user }&filename=${ filename }`);
    return res.status(200).send({ success: true });
  } catch {
    console.log('Error', error);
    return res.status(400).send({ error: 'Some error occurred!' });
  }
});

app.post('/uploadfile', upload.single('file'), async (req, res) => {
  const user = req.signedCookies.userId;
  const rating = req.body.rating;
  const file = req.file;
  const formData = new FormData();

  if (!user) {
    res.redirect('/auth');
  }

  formData.append("image", file.buffer, { filename: file.originalname });
  formData.append('user', user);
  formData.append('rating', rating);

  try {
    await axios.post(`${ API_URL }/addrating`, formData, { headers: formData.getHeaders() });
    return res.status(200).send({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).send({ error: 'Some error occurred!' });
  }
});

/* --- Start app --- */
app.listen(APP_PORT, () => {
  console.log(`Man of Culture WebUI is running at ${ fullAppUrl }`);
});