import { TestBed } from '@angular/core/testing';
import { CanActivateChildFn } from '@angular/router';

import { AuthChildGuard } from './auth-child-guard';

describe('authChildGuard', () => {
  const executeGuard: CanActivateChildFn = (...guardParameters) => 
      TestBed.runInInjectionContext(() => AuthChildGuard(...guardParameters));

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('should be created', () => {
    expect(executeGuard).toBeTruthy();
  });
});
