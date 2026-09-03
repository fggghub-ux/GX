'use strict';

// U2 backup worker. The archive is a standards-compliant, store-only ZIP so
// it can be inspected with normal archive tools while avoiding Base64 copies
// of large assets. This file deliberately has no network dependencies.

const BACKUP_FORMAT = 'u2backup';
const BACKUP_VERSION = 10;
const ZIP_METHOD_STORE = 0;
const ZIP_FLAG_DATA_DESCRIPTOR = 0x0008;
const ROW_BATCH_SIZE = 48;
const IO_CHUNK_SIZE = 192 * 1024;
const MAX_ENTRY_BYTES = 0x7fffffff;
const MAX_LINE_BYTES = 8 * 1024 * 1024;
const cancelledOperations = new Set();
const backupWorkerScope = typeof self !== 'undefined' ? self : globalThis;
let backupRuntimePort = null;

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let index = 0; index < 256; index += 1) {
        let value = index;
        for (let bit = 0; bit < 8; bit += 1) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
        table[index] = value >>> 0;
    }
    return table;
})();

function makeError(code, message) {
    const error = new Error(message);
    error.code = code;
    return error;
}

function checkCancelled(id) {
    if (cancelledOperations.has(id)) throw makeError('BACKUP_CANCELLED', '备份操作已取消。');
}

function updateCrc(crc, bytes) {
    let next = crc >>> 0;
    for (let index = 0; index < bytes.length; index += 1) {
        next = CRC_TABLE[(next ^ bytes[index]) & 0xff] ^ (next >>> 8);
    }
    return next >>> 0;
}

function finalCrc(crc) {
    return (crc ^ 0xffffffff) >>> 0;
}

function writeU16(view, offset, value) {
    view.setUint16(offset, value >>> 0, true);
}

function writeU32(view, offset, value) {
    view.setUint32(offset, value >>> 0, true);
}

function createLocalHeader(nameBytes) {
    const bytes = new Uint8Array(30 + nameBytes.length);
    const view = new DataView(bytes.buffer);
    writeU32(view, 0, 0x04034b50);
    writeU16(view, 4, 20);
    writeU16(view, 6, ZIP_FLAG_DATA_DESCRIPTOR);
    writeU16(view, 8, ZIP_METHOD_STORE);
    writeU16(view, 10, 0);
    writeU16(view, 12, 0);
    writeU32(view, 14, 0);
    writeU32(view, 18, 0);
    writeU32(view, 22, 0);
    writeU16(view, 26, nameBytes.length);
    writeU16(view, 28, 0);
    bytes.set(nameBytes, 30);
    return bytes;
}

function createDataDescriptor(crc, size) {
    const bytes = new Uint8Array(16);
    const view = new DataView(bytes.buffer);
    writeU32(view, 0, 0x08074b50);
    writeU32(view, 4, crc);
    writeU32(view, 8, size);
    writeU32(view, 12, size);
    return bytes;
}

function createCentralEntry(entry) {
    const bytes = new Uint8Array(46 + entry.nameBytes.length);
    const view = new DataView(bytes.buffer);
    writeU32(view, 0, 0x02014b50);
    writeU16(view, 4, 20);
    writeU16(view, 6, 20);
    writeU16(view, 8, ZIP_FLAG_DATA_DESCRIPTOR);
    writeU16(view, 10, ZIP_METHOD_STORE);
    writeU16(view, 12, 0);
    writeU16(view, 14, 0);
    writeU32(view, 16, entry.crc);
    writeU32(view, 20, entry.size);
    writeU32(view, 24, entry.size);
    writeU16(view, 28, entry.nameBytes.length);
    writeU16(view, 30, 0);
    writeU16(view, 32, 0);
    writeU16(view, 34, 0);
    writeU16(view, 36, 0);
    writeU32(view, 38, 0);
    writeU32(view, 42, entry.offset);
    bytes.set(entry.nameBytes, 46);
    return bytes;
}

function createEndOfCentralDirectory(entryCount, directorySize, directoryOffset) {
    const bytes = new Uint8Array(22);
    const view = new DataView(bytes.buffer);
    writeU32(view, 0, 0x06054b50);
    writeU16(view, 4, 0);
    writeU16(view, 6, 0);
    writeU16(view, 8, entryCount);
    writeU16(view, 10, entryCount);
    writeU32(view, 12, directorySize);
    writeU32(view, 16, directoryOffset);
    writeU16(view, 20, 0);
    return bytes;
}

class ZipWriter {
    constructor(operationId) {
        this.operationId = operationId;
        this.offset = 0;
        this.entries = [];
    }

    emit(bytes) {
        if (!bytes?.byteLength) return;
        checkCancelled(this.operationId);
        this.offset += bytes.byteLength;
        postBackupMessage({ type: 'chunk', operationId: this.operationId, buffer: bytes.buffer }, [bytes.buffer]);
    }

    async addEntry(name, source) {
        const nameBytes = encoder.encode(name);
        const entry = { name, nameBytes, offset: this.offset, crc: 0, size: 0 };
        this.emit(createLocalHeader(nameBytes));
        let crc = 0xffffffff;
        for await (const sourceChunk of source) {
            checkCancelled(this.operationId);
            const bytes = sourceChunk instanceof Uint8Array ? sourceChunk : new Uint8Array(sourceChunk);
            if (entry.size + bytes.byteLength > MAX_ENTRY_BYTES) {
                throw makeError('BACKUP_ENTRY_TOO_LARGE', `备份条目“${name}”超过 2 GB 上限。`);
            }
            crc = updateCrc(crc, bytes);
            entry.size += bytes.byteLength;
            this.emit(bytes);
        }
        entry.crc = finalCrc(crc);
        this.emit(createDataDescriptor(entry.crc, entry.size));
        this.entries.push(entry);
        return entry;
    }

    close() {
        const directoryOffset = this.offset;
        this.entries.forEach((entry) => this.emit(createCentralEntry(entry)));
        const directorySize = this.offset - directoryOffset;
        this.emit(createEndOfCentralDirectory(this.entries.length, directorySize, directoryOffset));
    }
}

function postBackupMessage(message, transfer = []) {
    if (backupRuntimePort) {
        backupRuntimePort.postMessage(message, transfer);
        return;
    }
    backupWorkerScope.postMessage(message, transfer);
}

function openDatabase(name) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(name);
        request.onerror = () => reject(request.error || makeError('BACKUP_DB_OPEN_FAILED', '无法打开本机数据。'));
        request.onsuccess = () => resolve(request.result);
    });
}

function requestResult(request) {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || makeError('BACKUP_DB_READ_FAILED', '读取数据失败。'));
    });
}

async function countStores(db, storeNames) {
    const result = {};
    for (const name of storeNames) {
        const transaction = db.transaction(name, 'readonly');
        result[name] = Number(await requestResult(transaction.objectStore(name).count())) || 0;
    }
    return result;
}

async function readBatch(db, storeName, afterKey, limit = ROW_BATCH_SIZE) {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const range = afterKey === undefined ? undefined : IDBKeyRange.lowerBound(afterKey, true);
    const [rows, keys] = await Promise.all([
        requestResult(store.getAll(range, limit)),
        requestResult(store.getAllKeys(range, limit))
    ]);
    return { rows: Array.isArray(rows) ? rows : [], keys: Array.isArray(keys) ? keys : [] };
}

async function writeRows(db, storeName, rows) {
    if (!rows.length) return;
    await new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        rows.forEach((row) => store.put(row));
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error || makeError('BACKUP_DB_WRITE_FAILED', `写入 ${storeName} 失败。`));
        transaction.onabort = () => reject(transaction.error || makeError('BACKUP_DB_WRITE_FAILED', `写入 ${storeName} 被取消。`));
    });
}

async function clearStore(db, storeName) {
    await new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        transaction.objectStore(storeName).clear();
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error || makeError('BACKUP_DB_CLEAR_FAILED', `清理 ${storeName} 失败。`));
    });
}

function assetArchivePath(assetId) {
    return `assets/${encodeURIComponent(String(assetId))}.bin`;
}

function makeLineSignature() {
    return { crc: 0xffffffff, count: 0 };
}

function updateLineSignature(signature, line) {
    signature.crc = updateCrc(signature.crc, encoder.encode(line));
    signature.count += 1;
}

function completeLineSignature(signature) {
    return { count: signature.count, crc32: finalCrc(signature.crc).toString(16).padStart(8, '0') };
}

function makeAssetBackupRecord(record) {
    const backupRecord = { ...record };
    delete backupRecord.blob;
    backupRecord.archivePath = assetArchivePath(record.id);
    backupRecord.blobSize = Math.max(0, Number(record?.blob?.size) || 0);
    backupRecord.mimeType = record?.blob?.type || record.mimeType || 'application/octet-stream';
    return backupRecord;
}

async function* bytesFromText(text) {
    yield encoder.encode(text);
}

async function* tableNdjsonSource(operationId, db, storeName, signature, progress) {
    let afterKey;
    let processed = 0;
    while (true) {
        checkCancelled(operationId);
        // Binary assets are handled as raw ZIP entries below.  Keep their
        // metadata pass to one item too, so a gallery of large photos cannot
        // make a single IndexedDB request retain dozens of blobs at once.
        const { rows, keys } = await readBatch(db, storeName, afterKey, storeName === 'assets' ? 1 : ROW_BATCH_SIZE);
        if (!rows.length) break;
        for (let index = 0; index < rows.length; index += 1) {
            checkCancelled(operationId);
            const value = storeName === 'assets' ? makeAssetBackupRecord(rows[index]) : rows[index];
            const line = `${JSON.stringify(value)}\n`;
            if (line.length > MAX_LINE_BYTES) throw makeError('BACKUP_RECORD_TOO_LARGE', `“${storeName}”中有一条数据过大，无法安全备份。`);
            updateLineSignature(signature, line);
            processed += 1;
            progress(processed);
            yield encoder.encode(line);
        }
        afterKey = keys[keys.length - 1];
        await new Promise((resolve) => setTimeout(resolve, 0));
    }
}

async function* blobSource(operationId, blob) {
    const size = Math.max(0, Number(blob?.size) || 0);
    for (let offset = 0; offset < size; offset += IO_CHUNK_SIZE) {
        checkCancelled(operationId);
        const slice = blob.slice(offset, Math.min(size, offset + IO_CHUNK_SIZE));
        yield new Uint8Array(await slice.arrayBuffer());
        await new Promise((resolve) => setTimeout(resolve, 0));
    }
}

async function exportBackup(operationId, payload) {
    const { dbName, storeNames, schemaVersion } = payload;
    const db = await openDatabase(dbName);
    try {
        const rowCounts = await countStores(db, storeNames);
        const totalRecords = Object.values(rowCounts).reduce((sum, count) => sum + count, 0);
        let completedRecords = 0;
        const report = (message, stage = 'export', extra = {}) => {
            postBackupMessage({
                type: 'progress', operationId, progress: {
                    message,
                    stage,
                    completedRecords,
                    totalRecords,
                    ...extra
                }
            });
        };
        const manifest = {
            format: BACKUP_FORMAT,
            formatVersion: BACKUP_VERSION,
            app: 'u2phone',
            schemaVersion,
            exportedAt: Date.now(),
            stores: storeNames.map((name) => ({ name, rowCount: rowCounts[name] || 0, entry: `tables/${name}.ndjson` })),
            stats: { storeCount: storeNames.length, recordCount: totalRecords, assetCount: rowCounts.assets || 0 },
            archive: { compression: 'store', assetEncoding: 'raw-blob' }
        };
        const writer = new ZipWriter(operationId);
        report('正在写入备份目录...', 'manifest');
        await writer.addEntry('manifest.json', bytesFromText(JSON.stringify(manifest)));
        const integrity = { format: BACKUP_FORMAT, formatVersion: BACKUP_VERSION, stores: {}, assets: {} };
        for (const storeName of storeNames) {
            const signature = makeLineSignature();
            report(`正在备份 ${storeName}...`, 'table', { storeName });
            await writer.addEntry(`tables/${storeName}.ndjson`, tableNdjsonSource(operationId, db, storeName, signature, (count) => {
                completedRecords += 1;
                if (count === 1 || count % ROW_BATCH_SIZE === 0) report(`正在备份 ${storeName} (${count}/${rowCounts[storeName] || 0})...`, 'table', { storeName });
            }));
            integrity.stores[storeName] = completeLineSignature(signature);
        }
        if ((rowCounts.assets || 0) > 0) {
            let afterKey;
            let assetIndex = 0;
            while (true) {
                const { rows, keys } = await readBatch(db, 'assets', afterKey, 1);
                if (!rows.length) break;
                for (const asset of rows) {
                    checkCancelled(operationId);
                    const path = assetArchivePath(asset.id);
                    const blob = asset?.blob;
                    if (!(blob instanceof Blob)) throw makeError('BACKUP_ASSET_MISSING', `资源 ${asset?.id || 'unknown'} 已损坏，无法包含在备份中。`);
                    report(`正在写入资源 (${assetIndex + 1}/${rowCounts.assets})...`, 'asset', { assetIndex, assetCount: rowCounts.assets });
                    const entry = await writer.addEntry(path, blobSource(operationId, blob));
                    integrity.assets[String(asset.id)] = { path, size: entry.size, crc32: entry.crc.toString(16).padStart(8, '0') };
                    assetIndex += 1;
                }
                afterKey = keys[keys.length - 1];
                await new Promise((resolve) => setTimeout(resolve, 0));
            }
        }
        report('正在写入完整性校验...', 'integrity');
        await writer.addEntry('integrity.json', bytesFromText(JSON.stringify(integrity)));
        writer.close();
        postBackupMessage({ type: 'complete', operationId, result: { manifest, integrity } });
    } finally {
        db.close();
    }
}

async function readTail(file) {
    const start = Math.max(0, file.size - 0xffff - 22);
    return new Uint8Array(await file.slice(start).arrayBuffer());
}

function findEndOfCentralDirectory(bytes) {
    for (let offset = bytes.length - 22; offset >= 0; offset -= 1) {
        if (new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0, true) === 0x06054b50) return offset;
    }
    throw makeError('BACKUP_ARCHIVE_INVALID', '备份归档缺少 ZIP 目录。');
}

async function readZipDirectory(file) {
    if (!file || file.size < 22) throw makeError('BACKUP_ARCHIVE_INVALID', '备份归档为空或不完整。');
    const tail = await readTail(file);
    const endOffset = findEndOfCentralDirectory(tail);
    const end = new DataView(tail.buffer, tail.byteOffset + endOffset, 22);
    const entryCount = end.getUint16(10, true);
    const directorySize = end.getUint32(12, true);
    const directoryOffset = end.getUint32(16, true);
    if (directoryOffset + directorySize > file.size || entryCount > 2048) throw makeError('BACKUP_ARCHIVE_INVALID', '备份归档目录无效。');
    const bytes = new Uint8Array(await file.slice(directoryOffset, directoryOffset + directorySize).arrayBuffer());
    const entries = new Map();
    let offset = 0;
    for (let index = 0; index < entryCount; index += 1) {
        const view = new DataView(bytes.buffer, bytes.byteOffset + offset);
        if (view.getUint32(0, true) !== 0x02014b50) throw makeError('BACKUP_ARCHIVE_INVALID', '备份归档目录条目无效。');
        const flags = view.getUint16(8, true);
        const method = view.getUint16(10, true);
        const crc = view.getUint32(16, true);
        const compressedSize = view.getUint32(20, true);
        const uncompressedSize = view.getUint32(24, true);
        const nameLength = view.getUint16(28, true);
        const extraLength = view.getUint16(30, true);
        const commentLength = view.getUint16(32, true);
        const localOffset = view.getUint32(42, true);
        const nameStart = offset + 46;
        const name = decoder.decode(bytes.subarray(nameStart, nameStart + nameLength));
        if ((flags & 1) || method !== ZIP_METHOD_STORE || compressedSize !== uncompressedSize || uncompressedSize > MAX_ENTRY_BYTES) {
            throw makeError('BACKUP_ARCHIVE_UNSUPPORTED', '该备份使用了不受支持的 ZIP 压缩或加密方式。');
        }
        entries.set(name, { name, crc, size: uncompressedSize, localOffset });
        offset = nameStart + nameLength + extraLength + commentLength;
    }
    return entries;
}

async function entryDataOffset(file, entry) {
    const header = new Uint8Array(await file.slice(entry.localOffset, entry.localOffset + 30).arrayBuffer());
    const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
    if (view.getUint32(0, true) !== 0x04034b50) throw makeError('BACKUP_ARCHIVE_INVALID', `归档条目 ${entry.name} 无效。`);
    return entry.localOffset + 30 + view.getUint16(26, true) + view.getUint16(28, true);
}

async function verifyEntry(file, entry, operationId) {
    const start = await entryDataOffset(file, entry);
    let crc = 0xffffffff;
    for (let offset = 0; offset < entry.size; offset += IO_CHUNK_SIZE) {
        checkCancelled(operationId);
        const bytes = new Uint8Array(await file.slice(start + offset, start + Math.min(entry.size, offset + IO_CHUNK_SIZE)).arrayBuffer());
        crc = updateCrc(crc, bytes);
    }
    if (finalCrc(crc) !== entry.crc) throw makeError('BACKUP_ARCHIVE_CORRUPT', `归档条目 ${entry.name} 的校验失败。`);
}

async function readSmallJson(file, entry, operationId) {
    if (!entry || entry.size > 2 * 1024 * 1024) throw makeError('BACKUP_ARCHIVE_INVALID', '备份元数据过大或缺失。');
    await verifyEntry(file, entry, operationId);
    const start = await entryDataOffset(file, entry);
    try {
        return JSON.parse(await file.slice(start, start + entry.size).text());
    } catch (error) {
        throw makeError('BACKUP_ARCHIVE_INVALID', '备份元数据不是有效 JSON。');
    }
}

async function inspectArchive(operationId, file) {
    const entries = await readZipDirectory(file);
    const manifest = await readSmallJson(file, entries.get('manifest.json'), operationId);
    if (manifest?.format !== BACKUP_FORMAT || Number(manifest?.formatVersion) !== BACKUP_VERSION) {
        throw makeError('BACKUP_ARCHIVE_UNSUPPORTED', '不是可识别的 U2 备份归档。');
    }
    const stores = Array.isArray(manifest.stores) ? manifest.stores : [];
    postBackupMessage({
        type: 'complete',
        operationId,
        result: {
            format: BACKUP_FORMAT,
            schemaVersion: Number(manifest.schemaVersion) || BACKUP_VERSION,
            exportedAt: Number(manifest.exportedAt) || 0,
            storeCount: stores.length,
            recordCount: Number(manifest.stats?.recordCount) || 0,
            assetCount: Number(manifest.stats?.assetCount) || 0,
            approximateBytes: Number(file.size) || 0,
            manifest
        }
    });
}

async function* entryLines(operationId, file, entry) {
    const start = await entryDataOffset(file, entry);
    let crc = 0xffffffff;
    let carry = '';
    for (let offset = 0; offset < entry.size; offset += IO_CHUNK_SIZE) {
        checkCancelled(operationId);
        const bytes = new Uint8Array(await file.slice(start + offset, start + Math.min(entry.size, offset + IO_CHUNK_SIZE)).arrayBuffer());
        crc = updateCrc(crc, bytes);
        carry += decoder.decode(bytes, { stream: offset + bytes.length < entry.size });
        let lineEnd;
        while ((lineEnd = carry.indexOf('\n')) >= 0) {
            const line = carry.slice(0, lineEnd);
            carry = carry.slice(lineEnd + 1);
            if (line.length > MAX_LINE_BYTES) throw makeError('BACKUP_RECORD_TOO_LARGE', `归档条目 ${entry.name} 包含过大的记录。`);
            if (line) yield line;
        }
        if (carry.length > MAX_LINE_BYTES) throw makeError('BACKUP_RECORD_TOO_LARGE', `归档条目 ${entry.name} 包含过大的记录。`);
        await new Promise((resolve) => setTimeout(resolve, 0));
    }
    if (carry.trim()) throw makeError('BACKUP_ARCHIVE_INVALID', `归档条目 ${entry.name} 缺少换行结束符。`);
    if (finalCrc(crc) !== entry.crc) throw makeError('BACKUP_ARCHIVE_CORRUPT', `归档条目 ${entry.name} 的校验失败。`);
}

async function restoreAssetBlob(operationId, file, entries, record, integrityAssets) {
    const path = String(record.archivePath || '');
    const entry = entries.get(path);
    if (!entry) throw makeError('BACKUP_ASSET_MISSING', `备份中缺少资源 ${record.id || path}。`);
    const expected = integrityAssets?.[String(record.id)];
    if (expected && (expected.path !== path || Number(expected.size) !== entry.size || String(expected.crc32) !== entry.crc.toString(16).padStart(8, '0'))) {
        throw makeError('BACKUP_ARCHIVE_CORRUPT', `资源 ${record.id || path} 的完整性校验失败。`);
    }
    await verifyEntry(file, entry, operationId);
    const start = await entryDataOffset(file, entry);
    return new Blob([file.slice(start, start + entry.size)], { type: record.mimeType || 'application/octet-stream' });
}

function validateRecord(storeName, record, keyFields) {
    const field = keyFields[storeName];
    if (!record || typeof record !== 'object' || record[field] === undefined || record[field] === null || record[field] === '') {
        throw makeError('BACKUP_RECORD_INVALID', `备份中的 ${storeName} 缺少 ${field || '主键'}。`);
    }
}

async function importArchive(operationId, payload) {
    const { file, shadowDbName, storeNames, keyFields } = payload;
    const entries = await readZipDirectory(file);
    const manifest = await readSmallJson(file, entries.get('manifest.json'), operationId);
    const integrity = await readSmallJson(file, entries.get('integrity.json'), operationId);
    if (manifest?.format !== BACKUP_FORMAT || Number(manifest?.formatVersion) !== BACKUP_VERSION || integrity?.format !== BACKUP_FORMAT) {
        throw makeError('BACKUP_ARCHIVE_UNSUPPORTED', '不是可导入的 U2 备份归档。');
    }
    const db = await openDatabase(shadowDbName);
    let completedRecords = 0;
    const totalRecords = Number(manifest.stats?.recordCount) || 0;
    const report = (message, stage = 'import', extra = {}) => postBackupMessage({
        type: 'progress', operationId, progress: { message, stage, completedRecords, totalRecords, ...extra }
    });
    try {
        for (const storeName of storeNames) {
            checkCancelled(operationId);
            report(`正在准备 ${storeName}...`, 'clear', { storeName });
            await clearStore(db, storeName);
        }
        for (const storeName of storeNames) {
            const entry = entries.get(`tables/${storeName}.ndjson`);
            if (!entry) throw makeError('BACKUP_ARCHIVE_INVALID', `备份缺少 ${storeName} 数据。`);
            const signature = makeLineSignature();
            const rows = [];
            let tableCount = 0;
            report(`正在导入 ${storeName}...`, 'table', { storeName });
            for await (const line of entryLines(operationId, file, entry)) {
                let record;
                try {
                    record = JSON.parse(line);
                } catch (error) {
                    throw makeError('BACKUP_RECORD_INVALID', `备份中的 ${storeName} 包含无效 JSON。`);
                }
                validateRecord(storeName, record, keyFields);
                updateLineSignature(signature, `${line}\n`);
                if (storeName === 'assets') {
                    record.blob = await restoreAssetBlob(operationId, file, entries, record, integrity.assets);
                    delete record.archivePath;
                    delete record.blobSize;
                }
                rows.push(record);
                tableCount += 1;
                completedRecords += 1;
                if (rows.length >= ROW_BATCH_SIZE) {
                    await writeRows(db, storeName, rows.splice(0, rows.length));
                    report(`正在导入 ${storeName} (${tableCount})...`, 'table', { storeName });
                }
            }
            await writeRows(db, storeName, rows);
            const expected = integrity.stores?.[storeName];
            const actual = completeLineSignature(signature);
            if (!expected || Number(expected.count) !== actual.count || String(expected.crc32) !== actual.crc32) {
                throw makeError('BACKUP_ARCHIVE_CORRUPT', `备份中的 ${storeName} 完整性校验失败。`);
            }
        }
        postBackupMessage({ type: 'complete', operationId, result: { manifest, report: { sourceFormat: BACKUP_FORMAT, sourceVersion: BACKUP_VERSION, stickers: { importedCategories: 0, importedItems: 0, skippedCategories: 0, skippedItems: 0, missingAssets: 0, invalidImages: 0, expiredBlobUrls: 0 } } } });
    } finally {
        db.close();
    }
}

function dataUrlToBlob(dataUrl) {
    const source = String(dataUrl || '');
    const separatorIndex = source.indexOf(',');
    if (!source.startsWith('data:') || separatorIndex < 0) throw makeError('BACKUP_RECORD_INVALID', '旧备份包含无效的资源数据。');
    const header = source.slice(0, separatorIndex);
    const data = source.slice(separatorIndex + 1);
    const mimeType = header.match(/^data:([^;,]*)/i)?.[1] || 'application/octet-stream';
    if (/;base64(?:;|$)/i.test(header)) {
        let normalized = data.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
        while (normalized.length % 4 !== 0) normalized += '=';
        const binary = atob(normalized);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
        return new Blob([bytes], { type: mimeType });
    }
    return new Blob([decodeURIComponent(data)], { type: mimeType });
}

async function* legacyJsonTextChunks(operationId, file) {
    const size = Math.max(0, Number(file?.size) || 0);
    const textDecoder = new TextDecoder();
    for (let offset = 0; offset < size; offset += IO_CHUNK_SIZE) {
        checkCancelled(operationId);
        const bytes = new Uint8Array(await file.slice(offset, Math.min(size, offset + IO_CHUNK_SIZE)).arrayBuffer());
        yield { text: textDecoder.decode(bytes, { stream: offset + bytes.length < size }), bytes: bytes.byteLength };
    }
}

// Current JSON snapshots have a top-level `stores` object whose entries are
// arrays of records. This incremental reader deliberately parses one object at
// a time instead of calling JSON.parse() on the entire selected file.
class LegacySnapshotStoresParser {
    constructor() {
        this.mode = 'seek-stores';
        this.seekIndex = 0;
        this.seekToken = '"stores"';
        this.currentKeyRaw = '';
        this.currentStore = '';
        this.rowRaw = '';
        this.inString = false;
        this.escaped = false;
        this.objectDepth = 0;
        this.foundStores = false;
        this.storesFinished = false;
        this.localStorageFound = false;
        this.localStorageFinished = false;
        this.localStorageSeekToken = '"localStorage"';
        this.localStorageSeekIndex = 0;
        this.rowKind = 'store';
    }

    push(text) {
        const rows = [];
        for (let index = 0; index < text.length; index += 1) {
            const char = text[index];
            if (this.mode === 'done') continue;
            if (this.mode === 'seek-stores') {
                if (char === this.seekToken[this.seekIndex]) this.seekIndex += 1;
                else this.seekIndex = char === this.seekToken[0] ? 1 : 0;
                if (this.seekIndex === this.seekToken.length) {
                    this.mode = 'seek-colon';
                    this.seekIndex = 0;
                }
                continue;
            }
            if (this.mode === 'seek-colon') {
                if (char === ':') this.mode = 'seek-object';
                continue;
            }
            if (this.mode === 'seek-object') {
                if (/\s/.test(char)) continue;
                if (char !== '{') throw makeError('LEGACY_SNAPSHOT_INVALID', '旧版 JSON 备份的 stores 字段无效。');
                this.foundStores = true;
                this.mode = 'field-start';
                continue;
            }
            if (this.mode === 'field-start') {
                if (/\s/.test(char) || char === ',') continue;
                if (char === '}') {
                    this.storesFinished = true;
                    this.mode = 'seek-local-storage';
                    continue;
                }
                if (char !== '"') throw makeError('LEGACY_SNAPSHOT_INVALID', '旧版 JSON 备份的存储表名称无效。');
                this.currentKeyRaw = '"';
                this.inString = true;
                this.escaped = false;
                this.mode = 'field-key';
                continue;
            }
            if (this.mode === 'field-key') {
                this.currentKeyRaw += char;
                if (this.escaped) this.escaped = false;
                else if (char === '\\') this.escaped = true;
                else if (char === '"') {
                    try { this.currentStore = JSON.parse(this.currentKeyRaw); } catch (error) { throw makeError('LEGACY_SNAPSHOT_INVALID', '旧版 JSON 备份的表名无法解析。'); }
                    this.mode = 'field-colon';
                }
                continue;
            }
            if (this.mode === 'field-colon') {
                if (/\s/.test(char)) continue;
                if (char !== ':') throw makeError('LEGACY_SNAPSHOT_INVALID', '旧版 JSON 备份缺少表值。');
                this.mode = 'field-array';
                continue;
            }
            if (this.mode === 'field-array') {
                if (/\s/.test(char)) continue;
                if (char !== '[') throw makeError('LEGACY_SNAPSHOT_INVALID', '旧版 JSON 备份的表不是记录数组。');
                this.mode = 'array-wait';
                continue;
            }
            if (this.mode === 'array-wait') {
                if (/\s/.test(char) || char === ',') continue;
                if (char === ']') { this.mode = 'field-start'; continue; }
                if (char !== '{') throw makeError('LEGACY_SNAPSHOT_INVALID', `旧版 JSON 备份的 ${this.currentStore} 存在无效记录。`);
                this.rowRaw = '{';
                this.objectDepth = 1;
                this.inString = false;
                this.escaped = false;
                this.rowKind = 'store';
                this.mode = 'row';
                continue;
            }
            if (this.mode === 'seek-local-storage') {
                if (char === this.localStorageSeekToken[this.localStorageSeekIndex]) this.localStorageSeekIndex += 1;
                else this.localStorageSeekIndex = char === this.localStorageSeekToken[0] ? 1 : 0;
                if (this.localStorageSeekIndex === this.localStorageSeekToken.length) {
                    this.localStorageSeekIndex = 0;
                    this.mode = 'legacy-storage-colon';
                }
                continue;
            }
            if (this.mode === 'legacy-storage-colon') {
                if (char === ':') this.mode = 'legacy-storage-array';
                continue;
            }
            if (this.mode === 'legacy-storage-array') {
                if (/\s/.test(char)) continue;
                if (char !== '[') throw makeError('LEGACY_SNAPSHOT_INVALID', '旧版 JSON 备份的 localStorage 字段无效。');
                this.localStorageFound = true;
                this.mode = 'legacy-storage-wait';
                continue;
            }
            if (this.mode === 'legacy-storage-wait') {
                if (/\s/.test(char) || char === ',') continue;
                if (char === ']') {
                    this.localStorageFinished = true;
                    this.mode = 'done';
                    continue;
                }
                if (char !== '{') throw makeError('LEGACY_SNAPSHOT_INVALID', '旧版 JSON 备份的 localStorage 包含无效记录。');
                this.rowRaw = '{';
                this.objectDepth = 1;
                this.inString = false;
                this.escaped = false;
                this.rowKind = 'legacy-storage';
                this.mode = 'row';
                continue;
            }
            if (this.mode === 'row') {
                this.rowRaw += char;
                if (this.inString) {
                    if (this.escaped) this.escaped = false;
                    else if (char === '\\') this.escaped = true;
                    else if (char === '"') this.inString = false;
                    continue;
                }
                if (char === '"') { this.inString = true; continue; }
                if (char === '{') this.objectDepth += 1;
                else if (char === '}') {
                    this.objectDepth -= 1;
                    if (this.objectDepth === 0) {
                        const rowName = this.rowKind === 'legacy-storage' ? 'localStorage' : this.currentStore;
                        if (this.rowRaw.length > MAX_LINE_BYTES) throw makeError('BACKUP_RECORD_TOO_LARGE', `旧备份中的 ${rowName} 含有过大的记录。`);
                        try {
                            const record = JSON.parse(this.rowRaw);
                            rows.push(this.rowKind === 'legacy-storage'
                                ? { legacyStorageRow: record }
                                : { storeName: this.currentStore, record });
                        } catch (error) { throw makeError('LEGACY_SNAPSHOT_INVALID', `旧备份中的 ${rowName} 含有无法解析的记录。`); }
                        this.rowRaw = '';
                        this.mode = this.rowKind === 'legacy-storage' ? 'legacy-storage-wait' : 'array-wait';
                    }
                }
            }
        }
        return rows;
    }
}

function normalizeLegacySnapshotRecord(storeName, record, keyFields) {
    const next = { ...(record || {}) };
    if (storeName === 'assets' && next.dataUrl) {
        next.blob = dataUrlToBlob(next.dataUrl);
        delete next.dataUrl;
    }
    validateRecord(storeName, next, keyFields);
    return next;
}

const LEGACY_STORAGE_SETTINGS = {
    u2_userState: 'userState',
    u2_apiConfig: 'apiConfig',
    u2_vectorMemoryConfig: 'vectorMemoryConfig',
    u2_ttsConfig: 'ttsConfig',
    u2_minimaxConfig: 'minimaxConfig',
    u2_apiPresets: 'apiPresets',
    u2_fetchedModels: 'fetchedModels',
    u2_assistiveBallSettings: 'assistiveBallSettings',
    u2_accounts: 'accounts',
    u2_currentAccountId: 'currentAccountId',
    u2_themeState: 'themeState',
    u2_worldBooks: 'worldBooks',
    u2_wbGroups: 'wbGroups'
};

function isPlainRecord(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function parseLegacyStorageValue(rawValue) {
    if (rawValue === undefined || rawValue === null) return undefined;
    try {
        return JSON.parse(String(rawValue));
    } catch (error) {
        const text = String(rawValue);
        return text.startsWith('blob:') ? '' : text;
    }
}

async function readStoreRecord(db, storeName, key) {
    const transaction = db.transaction(storeName, 'readonly');
    return requestResult(transaction.objectStore(storeName).get(key));
}

async function readStoreRowsByKeys(db, storeName, keys) {
    const uniqueKeys = [...new Set(keys.map((key) => String(key)))];
    const rows = [];
    for (let start = 0; start < uniqueKeys.length; start += ROW_BATCH_SIZE) {
        const batch = uniqueKeys.slice(start, start + ROW_BATCH_SIZE);
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const values = await Promise.all(batch.map((key) => requestResult(store.get(key))));
        rows.push(...values.filter(Boolean));
    }
    return rows;
}

async function applyLegacyStorageRows(db, state, schemaVersion) {
    if (!state.keys.length) return;
    const now = Date.now();
    const requestedDomains = ['settings', 'legacy'];
    const oldAppState = state.values.u2_appState;
    if (isPlainRecord(oldAppState)) {
        for (const name of Object.keys(oldAppState)) {
            if (name) requestedDomains.push(name);
        }
    }
    const existingDomains = new Map((await readStoreRowsByKeys(db, 'app_domains', requestedDomains))
        .map((record) => [String(record.name), record]));
    const currentSettings = existingDomains.get('settings') || null;
    const currentLegacy = existingDomains.get('legacy') || null;
    const settings = isPlainRecord(currentSettings?.value) ? { ...currentSettings.value } : {};
    const legacy = isPlainRecord(currentLegacy?.value) ? { ...currentLegacy.value } : {};
    let settingsChanged = false;
    let legacyChanged = false;
    for (const [key, value] of Object.entries(state.values)) {
        if (key === 'u2_mockAuthSession' || key === 'u2_appState') continue;
        const settingKey = LEGACY_STORAGE_SETTINGS[key];
        if (settingKey) {
            if (!Object.prototype.hasOwnProperty.call(settings, settingKey) && value !== undefined) {
                settings[settingKey] = value;
                settingsChanged = true;
            }
        } else if (!Object.prototype.hasOwnProperty.call(legacy, key) && value !== undefined) {
            legacy[key] = value;
            legacyChanged = true;
        }
    }
    const domainRows = [];
    if (settingsChanged || !currentSettings) {
        domainRows.push({
            name: 'settings', schemaVersion, revision: Math.max(0, Number(currentSettings?.revision) || 0) + 1,
            updatedAt: now, value: settings
        });
    }
    if (legacyChanged || !currentLegacy) {
        domainRows.push({
            name: 'legacy', schemaVersion, revision: Math.max(0, Number(currentLegacy?.revision) || 0) + 1,
            updatedAt: now, value: legacy
        });
    }
    if (isPlainRecord(oldAppState)) {
        for (const [name, value] of Object.entries(oldAppState)) {
            if (!name || !isPlainRecord(value)) continue;
            const existing = existingDomains.get(String(name));
            if (!existing) domainRows.push({ name, schemaVersion, revision: 1, updatedAt: now, value });
        }
    }
    if (domainRows.length) await writeRows(db, 'app_domains', domainRows);
    await writeRows(db, 'meta', [{
        key: 'legacy_backup_imported_at', value: { importedAt: now, keys: state.keys }
    }]);
}

async function streamLegacySnapshot(operationId, payload, mode = 'import') {
    const { file, shadowDbName, storeNames, keyFields, schemaVersion = BACKUP_VERSION, sourceVersion = 7 } = payload;
    const parser = new LegacySnapshotStoresParser();
    const allowedStores = new Set(storeNames || []);
    const counts = Object.fromEntries((storeNames || []).map((name) => [name, 0]));
    const rowsByStore = new Map();
    const legacyStorageState = { keys: [], values: {} };
    const totalBytes = Math.max(0, Number(file?.size) || 0);
    let completedBytes = 0;
    let db = null;
    const report = (message, stage = 'legacy-json', extra = {}) => postBackupMessage({
        type: 'progress', operationId, progress: { message, stage, completedBytes, totalBytes, ...extra }
    });
    try {
        if (mode === 'import') {
            db = await openDatabase(shadowDbName);
            for (const storeName of storeNames) await clearStore(db, storeName);
        }
        for await (const chunk of legacyJsonTextChunks(operationId, file)) {
            completedBytes += chunk.bytes;
            const parsedRows = parser.push(chunk.text);
            for (const parsedRow of parsedRows) {
                if (parsedRow.legacyStorageRow) {
                    const legacyRow = parsedRow.legacyStorageRow;
                    if (legacyRow?.key) {
                        const key = String(legacyRow.key);
                        if (!Object.prototype.hasOwnProperty.call(legacyStorageState.values, key)) {
                            legacyStorageState.keys.push(key);
                            legacyStorageState.values[key] = parseLegacyStorageValue(legacyRow.value);
                        }
                    }
                    continue;
                }
                const { storeName, record } = parsedRow;
                if (!allowedStores.has(storeName)) continue;
                counts[storeName] += 1;
                if (mode === 'import') {
                    const rows = rowsByStore.get(storeName) || [];
                    const normalized = normalizeLegacySnapshotRecord(storeName, record, keyFields);
                    rows.push(normalized);
                    rowsByStore.set(storeName, rows);
                    if (rows.length >= ROW_BATCH_SIZE) await writeRows(db, storeName, rows.splice(0, rows.length));
                }
            }
            report(mode === 'import' ? '正在分批读取旧版 JSON 备份...' : '正在扫描旧版 JSON 备份...');
        }
        if (!parser.foundStores || !parser.storesFinished || parser.mode === 'row') {
            throw makeError('LEGACY_SNAPSHOT_NOT_FOUND', '该 JSON 不是可流式导入的 v7–v9 备份。');
        }
        if (mode === 'import') {
            for (const [storeName, rows] of rowsByStore) await writeRows(db, storeName, rows);
            await applyLegacyStorageRows(db, legacyStorageState, Number(schemaVersion) || BACKUP_VERSION);
        }
        const recordCount = Object.values(counts).reduce((sum, count) => sum + count, 0);
        const result = {
            format: 'legacy-json-stream', schemaVersion: Number(sourceVersion) || 7, exportedAt: 0,
            storeCount: Object.values(counts).filter((count) => count > 0).length,
            recordCount, assetCount: counts.assets || 0, approximateBytes: totalBytes,
            localStorageKeyCount: legacyStorageState.keys.length,
            report: { sourceFormat: 'legacy-json-stream', sourceVersion: Number(sourceVersion) || 7, stickers: { importedCategories: 0, importedItems: 0, skippedCategories: 0, skippedItems: 0, missingAssets: 0, invalidImages: 0, expiredBlobUrls: 0 } }
        };
        postBackupMessage({ type: 'complete', operationId, result });
    } finally {
        db?.close();
    }
}

async function run(operationId, command, payload) {
    try {
        if (command === 'export') await exportBackup(operationId, payload);
        else if (command === 'inspect') await inspectArchive(operationId, payload.file);
        else if (command === 'import') await importArchive(operationId, payload);
        else if (command === 'inspectLegacySnapshot') await streamLegacySnapshot(operationId, payload, 'inspect');
        else if (command === 'importLegacySnapshot') await streamLegacySnapshot(operationId, payload, 'import');
        else throw makeError('BACKUP_COMMAND_INVALID', '未知备份操作。');
    } catch (error) {
        postBackupMessage({ type: 'error', operationId, error: { code: error?.code || 'BACKUP_FAILED', message: error?.message || String(error) } });
    } finally {
        cancelledOperations.delete(operationId);
    }
}

function handleBackupMessage(event) {
    const data = event.data || {};
    if (data.type === 'abort') {
        cancelledOperations.add(data.operationId);
        return;
    }
    if (data.type === 'run') void run(data.operationId, data.command, data.payload || {});
}

function startBackupRuntime(port) {
    backupRuntimePort = port;
    backupRuntimePort.addEventListener('message', handleBackupMessage);
    backupRuntimePort.start?.();
}

if (typeof document === 'undefined') {
    backupWorkerScope.addEventListener('message', handleBackupMessage);
} else {
    globalThis.u2BackupWorkerRuntime = { start: startBackupRuntime };
}
