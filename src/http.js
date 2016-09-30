import request from 'request';

export function get(url) {
  return new Promise((resolve, reject) => {
    request({
      method: 'GET',
      url,
      headers: {
        'User-Agent': 'request'
      }
    }, (err, response) => {
      if (err) {
        return reject(err);
      }

      return resolve(response);
    });
  })
}
