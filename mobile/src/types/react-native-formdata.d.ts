/**
 * React Native FormData type augmentation
 *
 * React Native's FormData.append() accepts an object literal with
 * { uri, type, name } for file uploads, but TypeScript's DOM FormData
 * type only accepts Blob | string. This declaration adds the RN overload.
 */

interface FormDataFileValue {
  uri: string;
  type: string;
  name: string;
}

interface FormData {
  append(name: string, value: FormDataFileValue): void;
}
