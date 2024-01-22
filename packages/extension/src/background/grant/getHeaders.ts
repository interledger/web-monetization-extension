export const getHeaders = (gnapToken: string) => ({
  headers: {
    Authorization: `GNAP ${gnapToken}`,
  },
});
