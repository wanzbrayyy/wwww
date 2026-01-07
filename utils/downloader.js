const axios = require('axios');

async function tiktokdl(url) {
    return new Promise(async (resolve, reject) => {
        try {
            const response = await axios.get(`https://www.tikwm.com/api/?url=${url}`);
            const { data } = response.data;
            if (data) {
                resolve({
                    status: true,
                    text: data.title,
                    cover: data.cover,
                    videonowm: data.play,
                    videonowm2: data.wmplay,
                    music: data.music,
                    author: data.author.nickname,
                    avatar: data.author.avatar,
                    images: data.images || null
                });
            } else {
                reject(new Error('Video tidak ditemukan.'));
            }
        } catch (e) {
            reject(new Error('Gagal menghubungi server TikTok.'));
        }
    });
}

async function igStalk(username) {
    return new Promise(async (resolve, reject) => {
        try {
            const cleanUser = username.replace('@', '').trim();
            // Ganti ke API Agatz
            const { data } = await axios.get(`https://api.agatz.xyz/api/stalkig?username=${cleanUser}`);

            if (data.status === 200 && data.data) {
                const res = data.data;
                resolve({
                    status: true,
                    username: res.username,
                    fullname: res.full_name || res.username,
                    bio: res.biography || 'Tidak ada bio',
                    photo: res.profile_pic_url_hd || res.profile_pic_url,
                    followers: res.edge_followed_by?.count || 0,
                    following: res.edge_follow?.count || 0,
                    posts: res.edge_owner_to_timeline_media?.count || 0,
                    isPrivate: res.is_private || false,
                    verified: res.is_verified || false,
                    url: `https://instagram.com/${res.username}`
                });
            } else {
                reject(new Error('Username tidak ditemukan.'));
            }
        } catch (e) {
            console.error('IG Stalk Error:', e.message);
            reject(new Error('Gagal mengambil data profil.'));
        }
    });
}

async function igDownload(url) {
    return new Promise(async (resolve, reject) => {
        try {
            // Ganti ke API Agatz
            const { data } = await axios.get(`https://api.agatz.xyz/api/igdl?url=${url}`);

            if (data.status === 200 && data.data && data.data.length > 0) {
                const result = data.data.map(item => ({
                    url: item.url || item.download_url, 
                    thumb: item.thumbnail || item.url,
                    type: (item.url || item.download_url).includes('.mp4') ? 'video' : 'image'
                }));
                resolve(result);
            } else {
                reject(new Error('Media tidak ditemukan atau akun private.'));
            }
        } catch (e) {
            console.error('IG DL Error:', e.message);
            reject(new Error('Gagal download. Pastikan link benar.'));
        }
    });
}

module.exports = { tiktokdl, igStalk, igDownload };