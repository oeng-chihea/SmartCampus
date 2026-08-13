import { buildScanOrigin, detectLanIPv4, isPrivateIPv4 } from './lan.util';
import type { NetworkInterfaceInfo } from 'os';

describe('lan.util', () => {
  it('detects en0 Wi-Fi before other private addresses', () => {
    const interfaces: NodeJS.Dict<NetworkInterfaceInfo[]> = {
      lo0: [
        {
          address: '127.0.0.1',
          netmask: '255.0.0.0',
          family: 'IPv4',
          mac: '00:00:00:00:00:00',
          internal: true,
          cidr: '127.0.0.1/8',
        },
      ],
      utun0: [
        {
          address: '10.8.0.2',
          netmask: '255.255.255.255',
          family: 'IPv4',
          mac: '00:00:00:00:00:00',
          internal: false,
          cidr: '10.8.0.2/32',
        },
      ],
      en0: [
        {
          address: '192.168.1.23',
          netmask: '255.255.255.0',
          family: 'IPv4',
          mac: 'aa:bb:cc:dd:ee:ff',
          internal: false,
          cidr: '192.168.1.23/24',
        },
      ],
    };

    expect(detectLanIPv4(interfaces)).toBe('192.168.1.23');
  });

  it('returns null when only loopback is present', () => {
    const interfaces: NodeJS.Dict<NetworkInterfaceInfo[]> = {
      lo0: [
        {
          address: '127.0.0.1',
          netmask: '255.0.0.0',
          family: 'IPv4',
          mac: '00:00:00:00:00:00',
          internal: true,
          cidr: '127.0.0.1/8',
        },
      ],
    };

    expect(detectLanIPv4(interfaces)).toBeNull();
  });

  it('builds an HTTPS Wi-Fi origin even when the teacher tab is HTTP localhost', () => {
    expect(buildScanOrigin('192.168.1.23', 'http://localhost:4200')).toBe(
      'https://192.168.1.23:4200',
    );
  });

  it('falls back to localhost when Wi-Fi is disconnected', () => {
    expect(buildScanOrigin(null, 'http://127.0.0.1:4200')).toBe(
      'http://localhost:4200',
    );
  });

  it('keeps a non-loopback request origin when no LAN address exists', () => {
    expect(buildScanOrigin(null, 'http://10.0.0.8:4200/sessions')).toBe(
      'https://10.0.0.8:4200',
    );
  });

  it('classifies RFC1918 addresses and rejects link-local', () => {
    expect(isPrivateIPv4('192.168.0.5')).toBe(true);
    expect(isPrivateIPv4('10.1.2.3')).toBe(true);
    expect(isPrivateIPv4('172.16.0.1')).toBe(true);
    expect(isPrivateIPv4('172.32.0.1')).toBe(false);
    expect(isPrivateIPv4('169.254.1.1')).toBe(false);
    expect(isPrivateIPv4('8.8.8.8')).toBe(false);
  });
});
