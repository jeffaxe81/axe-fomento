export declare const MAX_FILE_BYTES: number;
export declare const MAX_MULTIPART_BYTES: number;
export declare function key(): Buffer;
export declare function detectAllowedMedia(input:Uint8Array):'application/pdf'|'image/png'|'image/jpeg'|null;
export declare function safeFileName(name:string):string;
export declare function encryptAttachment(bytes:Uint8Array,context:string):{
 ciphertext:Buffer;nonce:Buffer;authTag:Buffer;sha256:string
};
export declare function decryptAttachment(row:{
 nonce:Buffer;auth_tag:Buffer;ciphertext:Buffer;sha256:string;content_length:number
},context:string):Buffer;
