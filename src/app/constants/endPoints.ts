//Auth endpoints
export const loginApi: string = "/auth/login"
export const registerApi: string = "/auth/register"

//Users endpoints
export const usersApi: string = "/user"
export const createUserApi: string = "/user"
export const getUserApi: string = "/user"
export const getUserByIdApi: string = "/user/"
export const updateUserApi: string = "/user/"
export const deleteUserApi: string = "/user/"

//Speakers endpoints
export const speakersApi: string = "/speakers"
export const createSpeakerApi: string = "/speakers"
export const getSpeakersApi: string = "/speakers"
export const getSpeakerByIdApi: string = "/speakers/"
export const updateSpeakerApi: string = "/speakers/"
export const deleteSpeakerApi: string = "/speakers/"
export const getAllHistoryApi: string = "/speakers/all-history"
export const getBatteryStatsApi: string = "/speakers/battery/stats"
export const getSpeakerHistoryApi: string = "/history"
export const getSpeakerStatusApi: string = "/status"
export const getActiveSessionApi: string = "/active-session"
export const forceShutdownApi: string = "/force-shutdown"
export const getBatteryLevelApi: string = "/battery-level"
export const updateBatteryLevelApi: string = "/battery-level"

//Usage Sessions endpoints
export const usageSessionsApi: string = "/usage-sessions"

//Energy Measurements endpoints
export const energyMeasurementsApi: string = "/energy-measurements"

//History endpoints
export const historyApi: string = "/history"

//User Speakers endpoints
export const userSpeakersApi: string = "/userspeakers"

//ESP32 Data endpoints (Energy API)
export const esp32Data: string = "/api/energy"
export const getRealtimeDataBySessionApi: string = "/realtime-data/"
export const postMonitorDataApi: string = "/monitor-data"
export const postRealtimeDataApi: string = "/realtime-data"
export const startSessionApi: string = "/start-session"
export const endSessionApi: string = "/end-session/"
export const getActiveSpeakerSessionApi: string = "/active-session/speaker/"
export const getSessionStatsApi: string = "/session-stats/"
export const cleanupCacheApi: string = "/cleanup-cache"
export const getCacheInfoApi: string = "/cache-info"
export const getHealthApi: string = "/health"
export const resetCacheApi: string = "/reset-cache/"
export const getSessionApi: string = "/session/"
export const hasCacheApi: string = "/has-cache/"
export const pingApi: string = "/ping"
export const getSystemStatsApi: string = "/system-stats"
export const setVolumeApi: string = "/volume/"
export const getVolumeApi: string = "/volume/"
export const increaseVolumeApi: string = "/volume/increase"
export const decreaseVolumeApi: string = "/volume/decrease"