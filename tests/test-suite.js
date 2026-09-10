import { deriveKeys, encryptMessage, decryptMessage, generateRoomFingerprint, encryptAttachment, decryptAttachment } from '../src/services/crypto.js';

async function runTests() {
    console.log('Starting Test Suite...');
    
    const password = 'my-secret-key';
    const roomName = 'test-room';
    const plainText = 'Hello World';

    try {
        console.log('Testing Key Derivation...');
        const keys = await deriveKeys(password, roomName);
        if (!keys || !keys.encryptionKey || !keys.authHash) {
            throw new Error('Key derivation failed to return proper keys');
        }
        console.log('✅ Key derivation passed.');

        console.log('Testing Encryption/Decryption...');
        const cipherText = await encryptMessage(plainText, keys.encryptionKey);
        
        if (cipherText === plainText) {
            throw new Error('Ciphertext is same as plaintext');
        }
        
        const decryptedText = await decryptMessage(cipherText, keys.encryptionKey);
        if (plainText !== decryptedText) {
            throw new Error('Decryption did not match plaintext');
        }
        console.log('✅ Crypto encryption/decryption passed.');

        console.log('Testing Tampered Ciphertext...');
        const payload = JSON.parse(cipherText);
        // Tamper with IV
        const badIvPayload = { ...payload, iv: btoa('badiv') };
        try {
            await decryptMessage(JSON.stringify(badIvPayload), keys.encryptionKey);
            throw new Error('Tampered ciphertext should have thrown');
        } catch (e) {
            console.log('✅ Tampered ciphertext correctly failed.');
        }

        console.log('Testing Wrong Key...');
        const wrongKeys = await deriveKeys('wrong-password', roomName);
        try {
            await decryptMessage(cipherText, wrongKeys.encryptionKey);
            throw new Error('Wrong key should have thrown');
        } catch (e) {
            console.log('✅ Wrong key correctly failed.');
        }

        console.log('Testing Empty Message Encryption...');
        const emptyCipher = await encryptMessage('', keys.encryptionKey);
        const emptyDecrypted = await decryptMessage(emptyCipher, keys.encryptionKey);
        if (emptyDecrypted !== '') {
            throw new Error('Empty message failed');
        }
        console.log('✅ Empty message encryption passed.');
        
        console.log('Testing Missing Key (Encryption)...');
        try {
            await encryptMessage(plainText, null);
            throw new Error('Encryption without key should throw');
        } catch(e) {
            console.log('✅ Encryption without key failed securely.');
        }

        console.log('Testing Fingerprint Generation...');
        const fp1 = await generateRoomFingerprint(roomName, password);
        const fp2 = await generateRoomFingerprint(roomName, password);
        if (!fp1 || fp1 !== fp2) {
            throw new Error('Fingerprint mismatch');
        }
        console.log('✅ Room fingerprint passed.');

        console.log('Testing Attachment Crypto...');
        const mockFileText = 'this is a test image file contents';
        const fileBlob = new Blob([mockFileText], { type: 'text/plain' });
        
        const { ciphertextBlob, attachmentKeyStr, ivStr } = await encryptAttachment(fileBlob);
        if (!ciphertextBlob || !attachmentKeyStr || !ivStr) {
             throw new Error('Attachment encryption missing parts');
        }
        
        const decryptedBlob = await decryptAttachment(ciphertextBlob, attachmentKeyStr, ivStr);
        const attachDecryptedText = await decryptedBlob.text();
        
        if (attachDecryptedText !== mockFileText) {
            throw new Error('Attachment decryption failed to match plaintext');
        }
        console.log('✅ Attachment encryption/decryption passed.');

        console.log('Testing Tampered Attachment Ciphertext...');
        const tamperedCiphertextBuffer = await ciphertextBlob.arrayBuffer();
        const tamperedView = new Uint8Array(tamperedCiphertextBuffer);
        tamperedView[0] = tamperedView[0] ^ 0xFF; // tamper first byte
        const tamperedBlob = new Blob([tamperedView]);
        
        try {
            await decryptAttachment(tamperedBlob, attachmentKeyStr, ivStr);
            throw new Error('Tampered attachment should have thrown');
        } catch (e) {
            console.log('✅ Tampered attachment correctly failed.');
        }

        console.log('Testing Wrong Attachment Key...');
        const { attachmentKeyStr: wrongAttachKey } = await encryptAttachment(new Blob(['dummy']));
        try {
            await decryptAttachment(ciphertextBlob, wrongAttachKey, ivStr);
            throw new Error('Wrong attachment key should have thrown');
        } catch (e) {
            console.log('✅ Wrong attachment key correctly failed.');
        }

        console.log('🎉 All Crypto Tests passed successfully.');
        process.exit(0);

    } catch (e) {
        console.error('❌ Crypto test failed:', e.message);
        process.exit(1);
    }
}

runTests();
