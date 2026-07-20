const expectedHost = 'mongodb:27017';

function isPrimary() {
  try {
    const status = db.adminCommand({ replSetGetStatus: 1 });
    return status.ok === 1 && status.myState === 1;
  } catch (error) {
    return false;
  }
}

function reconcileSingleMemberHost() {
  try {
    const config = rs.conf();
    if (config.members.length !== 1) {
      print('Refusing to change a replica set that is not single-node');
      return false;
    }
    if (config.members[0].host === expectedHost) {
      return true;
    }
    config.members[0].host = expectedHost;
    rs.reconfig(config, { force: true });
    return true;
  } catch (error) {
    print(error);
    return false;
  }
}

if (isPrimary()) {
  if (!reconcileSingleMemberHost()) {
    quit(1);
  }
  quit(isPrimary() ? 0 : 1);
}

try {
  db.adminCommand({
    replSetInitiate: {
      _id: 'rs0',
      members: [{ _id: 0, host: expectedHost }],
    },
  });
} catch (error) {
  if (error.codeName !== 'AlreadyInitialized' && error.code !== 23) {
    print(error);
    quit(1);
  }
  if (!reconcileSingleMemberHost()) {
    quit(1);
  }
}

quit(isPrimary() ? 0 : 1);
