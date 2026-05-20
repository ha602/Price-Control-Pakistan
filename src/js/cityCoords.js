// ============================================================
// Approximate lat/lng for supported Pakistan cities (for map view)
// ============================================================

export const CITY_COORDS = {
  Karachi:          [24.8607, 67.0011],
  Lahore:           [31.5204, 74.3587],
  Islamabad:        [33.6844, 73.0479],
  Rawalpindi:       [33.5651, 73.0169],
  Faisalabad:       [31.4504, 73.1350],
  Multan:           [30.1575, 71.5249],
  Peshawar:         [34.0151, 71.5249],
  Quetta:           [30.1798, 66.9750],
  Hyderabad:        [25.3960, 68.3578],
  Sialkot:          [32.4945, 74.5229],
  Gujranwala:       [32.1877, 74.1945],
  Bahawalpur:       [29.3956, 71.6836],
  Sargodha:         [32.0836, 72.6711],
  Sukkur:           [27.7052, 68.8574],
  Larkana:          [27.5590, 68.2123],
  Mardan:           [34.1989, 72.0231],
  Abbottabad:       [34.1688, 73.2215],
  'Dera Ghazi Khan':[30.0561, 70.6403],
  Mirpur:           [33.1450, 73.7517],
  Muzaffarabad:    [34.3700, 73.4711],
  Gilgit:           [35.9221, 74.3087]
}

export function getCoords(cityName) {
  return CITY_COORDS[cityName] || null
}
