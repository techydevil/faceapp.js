// Local Dependencies
const { generateDeviceID, API_BASE_URL, API_USER_AGENT, TEST_IMAGE_URL } = require('./constants')

// Package Dependencies
const superagent = require('superagent')

/**
 * @typedef {Object} Filter
 * @property {string} id
 * @property {string} title
 * @property {boolean} cropped
 * @property {boolean} paid
 */

/**
 * @typedef {Object} AvailableFilters
 * @property {string} code
 * @property {string} deviceID
 * @property {Filter[]} filters
 */

/**
 * @param {string|Buffer} file Input File
 * @returns {Promise.<AvailableFilters>}
 */
const getAvailableFilters = async file => {
  const deviceID = generateDeviceID()

  try {
    const { body } = await superagent.post(`${API_BASE_URL}/api/v2.11/photos`)
      .set('User-Agent', API_USER_AGENT)
      .set('X-FaceApp-DeviceID', deviceID)
      .attach('file', file, 'image.png')

    const { code } = body
    const filters = body.objects[0].children
      .map(o => ({
        id: o.id,
        title: o.title,
        cropped: o.is_paid ? true : o.only_cropped,
        paid: o.is_paid,
      }))

    return { code, deviceID, filters }
  } catch (err) {
    throw err
  }
}

/**
 * @param {AvailableFilters} args Input Object
 * @param {string} filterID Filter ID
 * @returns {Promise.<Buffer>}
 */
const getFilterImage = async (args, filterID = 'no-filter') => {
  const filterArr = args.filters.filter(o => o.id === filterID)

  if (filterArr.length === 0) {
    let filters = args.filters.map(o => o.id).join(', ')
    throw new Error(`Invalid Filter ID\nAvailable Filters: '${filters}'`)
  }

  const [filter] = filterArr
  const cropped = filter.cropped ? '1' : '0'
  const url = `${API_BASE_URL}/api/v2.11/photos/${args.code}/filters/${filter.id}?cropped=${cropped}`

  try {
    const { body } = await superagent.get(url)
      .set('User-Agent', API_USER_AGENT)
      .set('X-FaceApp-DeviceID', args.deviceID)

    return body
  } catch (err) {
    throw err
  }
}

/**
 * Runs an image through the [FaceApp](https://www.faceapp.com/) Algorithm
 *
 * For a list of filters see `listFilters()`
 * @param {string|Buffer} path Path to Image OR Image Buffer
 * @param {string} [filterID] Filter ID
 * @returns {Promise.<Buffer>}
 * @example
 * let image = await faceApp('./path/to/image.png', 'female_2')
 */
const process = async (path, filterID) => {
  try {
    const arg = await getAvailableFilters(path)
    const img = await getFilterImage(arg, filterID)

    return img
  } catch (err) {
    if (err.status === 400) {
      /**
       * @type {string}
       */
      const code = err.response.body.err.code || ''

      // Known Error Codes
      if (code === 'photo_no_faces') throw new Error('No Faces found in Photo')
      else if (code === 'bad_filter_id') throw new Error('Invalid Filter ID')
      else throw err
    } else {
      throw err
    }
  }
}

/**
 * Lists all available filters
 * @param {boolean} [minimal=false] Whether to only return an array of filter IDs (no extra metadata)
 * @returns {Promise.<Filter[]>|Promise.<string[]>}
 */
const listFilters = async (minimal = false) => {
  try {
    const { body } = await superagent.get(TEST_IMAGE_URL)
    const allFilters = await getAvailableFilters(body)

    return minimal ?
      allFilters.filters.map(a => a.id) :
      allFilters.filters
  } catch (err) {
    throw err
  }
}

module.exports = {
  process,
  listFilters,
}
