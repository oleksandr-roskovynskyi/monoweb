import elliptic from 'elliptic';

// Generates key from enc_key and pin.
function getKey(pin: string, data: string): string {
    // https://cdnjs.cloudflare.com/ajax/libs/crypto-js/3.1.9-1/crypto-js.js or only parts.
    function wordsArrayToIntArray(wordsArray) {
        return Uint8Array.from(atob(wordsArray.toString(CryptoJS.enc.Base64)), c => c.charCodeAt(0))
    }
    
    function intArrayToWordsArray(intArray) {
        return CryptoJS.enc.Base64.parse(btoa(String.fromCharCode.apply(null, intArray)));
    }
    
    let sha1 = CryptoJS.SHA1(pin);
    console.log('sha1', sha1.toString());
    let key = intArrayToWordsArray(wordsArrayToIntArray(sha1).slice(0, 16));
    console.log('sha1 cut', key.toString());
    
    var textWordsArray = CryptoJS.enc.Base64.parse(data);
    var textBytes = wordsArrayToIntArray(textWordsArray).slice(1);
    var textWordsArray = intArrayToWordsArray(textBytes)
    console.log('data', textWordsArray.toString());
    
    var iv = CryptoJS.enc.Hex.parse('00000000000000000000000000000000');
    var aesDecryptor = CryptoJS.algo.AES.createDecryptor(key, {
        mode: CryptoJS.mode.CTR,
        iv: iv,
        padding: CryptoJS.pad.NoPadding
    });
    var decrypted = aesDecryptor.process(textWordsArray);
    var decrypted1 = aesDecryptor.finalize();
    
    return decrypted.toString()+decrypted1.toString();   
}

// Generates private key from key.
function genPrivateKey(key: string): elliptic.ec.KeyPair {
    // https://cdn.jsdelivr.net/gh/indutny/elliptic/dist/elliptic.js
    const EC = elliptic.ec;
    const secp256k1 = new EC('secp256k1');

    return secp256k1.keyFromPrivate(key, 'hex');
}

// Signs data with a key.
function sign(key: elliptic.ec.KeyPair, data: string): elliptic.ec.Signature {
    const msg = CryptoJS.SHA256(data);

    return key.sign(msg.toString());
}

// Encodes signature according to monobank rules.
function transformSignature(signature: elliptic.ec.Signature): string {
    function trim32(arr: number[]): Int8Array {
        const rLength = r.length - 32;
        let trimmed: Int8Array;
        if (rLength < 0) {
            trimmed = new Int8Array(32)
            trimmed.set(r, -rLength)
        } else {
            trimmed = new Int8Array(r).subarray(rLength)
        }
        return trimmed;
    }

    const r = signature.r.toArray();
    const s = signature.s.toArray();
    
    let rPart = trim32(r);
    let sPart = trim32(s);

    let res = new Uint8Array(64);
    res.set(rPart);
    res.set(sPart, 32);
    
    return btoa(String.fromCharCode.apply(null, res));
}

function checkEncKeyLength(key: string): boolean {
    if (key.length == 32) {
        return false;
    }
    if (key.length == 33) {
        return key[0] !== ' ' ? false : true;
    }
    throw new Error(`Invalid key length = ${key.length}`);
}

function gen(pin: string, accessToken: string, encKeyBase64: string) {
    const encKey = atob(encKeyBase64);
    if (checkEncKeyLength(encKey)) {
        pin = "DEFAULT";
    }
    const key = getKey(pin, encKey);
    const privateKey = genPrivateKey(key);
    const signature = sign(privateKey, accessToken)
    const res = transformSignature(signature)
    
    return res;
}