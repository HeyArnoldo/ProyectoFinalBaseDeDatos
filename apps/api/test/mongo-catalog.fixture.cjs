function buildFixtureFilter(fixture) {
  return {
    _id: fixture._id,
    restaurantId: fixture.restaurantId,
  };
}

module.exports = { buildFixtureFilter };
