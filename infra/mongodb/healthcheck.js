function isPrimary() {
  try {
    const status = db.adminCommand({ replSetGetStatus: 1 });
    return status.ok === 1 && status.myState === 1;
  } catch (error) {
    return false;
  }
}

if (isPrimary()) {
  quit(0);
}

try {
  db.adminCommand({
    replSetInitiate: {
      _id: 'rs0',
      members: [{ _id: 0, host: 'mongodb:27017' }],
    },
  });
} catch (error) {
  if (error.codeName !== 'AlreadyInitialized' && error.code !== 23) {
    print(error);
    quit(1);
  }
}

quit(isPrimary() ? 0 : 1);
