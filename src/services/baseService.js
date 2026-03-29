import { getErrorMessage } from '../utils/helpers';

export function unwrapResponse(error, fallback) {
  if (error) {
    throw new Error(getErrorMessage(error, fallback));
  }
}
