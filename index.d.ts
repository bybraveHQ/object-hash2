// Type definitions for @bybrave/object-hash2
// Compatible with @types/object-hash (the typings of the original).

declare namespace hash {
    /**
     * A value that can be hashed: anything but `undefined` at the top level
     * (`undefined` inside objects and arrays is fine).
     */
    type NotUndefined = object | string | number | boolean | bigint | symbol | null;

    interface BaseOptions {
        /**
         * Hash algorithm to be used: 'sha1', 'md5', 'sha256', 'passthrough'...
         * In node every algorithm of `crypto.getHashes()` works; the browser
         * build supports 'md5', 'sha1' and 'sha256' (plus 'passthrough').
         * @default 'sha1'
         */
        algorithm?: 'sha1' | 'md5' | 'sha256' | 'passthrough' | (string & {});
    }

    interface NormalOption extends BaseOptions {
        /**
         * Hash encoding.
         * @default 'hex'
         */
        encoding?: 'hex' | 'binary' | 'base64';
    }

    interface BufferOption extends BaseOptions {
        /**
         * The hash is returned as raw bytes: a Buffer in node, a Uint8Array
         * in the browser build.
         */
        encoding: 'buffer';
    }

    interface CommonOptions {
        /** Hash object keys, values ignored. @default false */
        excludeValues?: boolean;
        /** Ignore unknown object types instead of throwing. @default false */
        ignoreUnknown?: boolean;
        /** Optional function that replaces values before hashing. */
        replacer?: (value: any) => any;
        /** Consider function properties when hashing. @default true */
        respectFunctionProperties?: boolean;
        /** Consider the 'name' property of functions. @default true */
        respectFunctionNames?: boolean;
        /**
         * Distinguish objects by what constructed them: instances of
         * different classes (and null-prototype objects) hash differently
         * from plain objects with the same data. @default true
         */
        respectType?: boolean;
        /** Sort all arrays before hashing. @default false */
        unorderedArrays?: boolean;
        /** Sort `Set` and `Map` instances before hashing. @default true */
        unorderedSets?: boolean;
        /** Sort object keys before hashing. @default true */
        unorderedObjects?: boolean;
        /** Exclude specific keys: return true to drop the key. */
        excludeKeys?: (key: string) => boolean;
    }

    type Options = (NormalOption | BufferOption) & CommonOptions;

    /** Hash using the sha1 algorithm (hex encoding). */
    function sha1(object: NotUndefined): string;
    /** Hash object keys only (values ignored) using the sha1 algorithm. */
    function keys(object: NotUndefined): string;
    /** Hash using the md5 algorithm (hex encoding). */
    function MD5(object: NotUndefined): string;
    /** Hash object keys only (values ignored) using the md5 algorithm. */
    function keysMD5(object: NotUndefined): string;
    /** Write the canonical serialization of the value to a stream. */
    function writeToStream(value: any, stream: { write: (str: string) => any }): void;
    function writeToStream(value: any, options: Options, stream: { write: (str: string) => any }): void;
}

/**
 * Generate a hash from any javascript value: objects, arrays, dates, Maps,
 * Sets, typed arrays, functions...
 */
declare function hash(object: hash.NotUndefined, options?: hash.NormalOption & hash.CommonOptions): string;
declare function hash(object: hash.NotUndefined, options: hash.BufferOption & hash.CommonOptions): Buffer;

export = hash;
