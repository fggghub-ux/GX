/**
 * 移动端数据本地存储模块 */
const StorageManager = {
    stripVolatileBlobUrls: function(value, seen = new WeakSet()) {
        if (typeof value === 'string') {
            return value.startsWith('blob:') ? null : value;
        }
        if (value == null || typeof value !== 'object') return value;
        if (seen.has(value)) return undefined;
        seen.add(value);

        if (Array.isArray(value)) {
            return value
                .map((item) => this.stripVolatileBlobUrls(item, seen))
                .filter((item) => item !== undefined);
        }

        const result = {};
        Object.keys(value).forEach((key) => {
            const nextValue = this.stripVolatileBlobUrls(value[key], seen);
            if (nextValue !== undefined) result[key] = nextValue;
        });
        return result;
    },

    /**
     * 保存数据到本地存储
     * @param {string} key 存储的键名
     * @param {any} value 要存储的数据（支持对象、数组等，会自动序列化为 JSON）
     * @returns {boolean} 是否保存成功
     */
    save: function(key, value) {
        try {
            if (!window.appStorage?.saveLegacyKey) return false;
            window.appStorage.saveLegacyKey(key, this.stripVolatileBlobUrls(value)).catch((error) => {
                console.error(`Storage save error for key "${key}":`, error);
            });
            return true;
        } catch (error) {
            console.error(`Storage save error for key "${key}":`, error);
            // 处理隐私模式下可能抛出的配额异常等
            return false;
        }
    },

    /**
     * 从本地存储读取数据
     * @param {string} key 存储的键名
     * @param {any} defaultValue 读取失败或不存在时的默认值
     * @returns {any} 解析后的数据或默认值
     */
    load: function(key, defaultValue = null) {
        try {
            return window.appStorage?.loadLegacyKey
                ? window.appStorage.loadLegacyKey(key, defaultValue)
                : defaultValue;
        } catch (error) {
            console.error(`Storage load error for key "${key}":`, error);
            return defaultValue;
        }
    },

    /**
     * 删除指定的本地存储数据
     * @param {string} key 存储的键名
     * @returns {boolean} 是否删除成功
     */
    remove: function(key) {
        try {
            if (!window.appStorage?.removeLegacyKey) return false;
            window.appStorage.removeLegacyKey(key).catch((error) => {
                console.error(`Storage remove error for key "${key}":`, error);
            });
            return true;
        } catch (error) {
            console.error(`Storage remove error for key "${key}":`, error);
            return false;
        }
    },

    /**
     * 清空所有本地存储数据
     */
    clearAll: function() {
        try {
            if (window.appStorage?.clearAllPersistentData) {
                window.appStorage.clearAllPersistentData().catch((error) => {
                    console.error('Storage clearAll error:', error);
                });
            }
        } catch (error) {
            console.error('Storage clearAll error:', error);
        }
    }
};

window.StorageManager = StorageManager;

window.u2LegacyStorageFacade = {
    getItem(key) {
        const value = StorageManager.load(key, null);
        if (value === null || value === undefined) return null;
        return typeof value === 'string' ? value : JSON.stringify(value);
    },
    setItem(key, rawValue) {
        let value = rawValue;
        try {
            value = JSON.parse(String(rawValue));
        } catch (error) {}
        StorageManager.save(key, value);
    },
    removeItem(key) {
        StorageManager.remove(key);
    }
};
