const axios = require('axios');
const FormData = require('form-data');

const uploadToCatbox = async (buffer, filename) => {
    try {
        const form = new FormData();
        form.append('reqtype', 'fileupload');
        form.append('userhash', 'd7eed82ae3aece8a4b6f473dd');
        form.append('fileToUpload', buffer, filename);

        const response = await axios.post('https://catbox.moe/user/api.php', form, {
            headers: form.getHeaders()
        });
        return response.data;
    } catch (error) {
        throw new Error('Gagal upload gambar');
    }
};

module.exports = { uploadToCatbox };