/**
 * Caseworker API Proxy Routes
 *
 * Server-side proxy for the Caseworker API.
 * This allows the frontend to make API calls through the server,
 * bypassing CORS restrictions.
 *
 * Endpoints:
 * - POST /api/caseworker-proxy/:subdomain/auth - Authenticate
 * - POST /api/caseworker-proxy/:subdomain/cases/search - Search cases
 * - GET  /api/caseworker-proxy/:subdomain/cases/:id - Get a case
 * - PATCH /api/caseworker-proxy/:subdomain/cases/:id - Update a case
 * - Any other path is forwarded as-is
 *
 * Custom Domain Support:
 * - Use "custom" as subdomain with ?domain=yourdomain.com query param
 * - Example: /api/caseworker-proxy/custom/auth?domain=aballinger.caseworkermp.com
 */

import { Router, Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../types';

export interface CaseworkerProxyRoutesDependencies {
  // No dependencies needed - this is a pure proxy
}

/**
 * Create caseworker proxy routes
 */
export function createCaseworkerProxyRoutes(_deps?: CaseworkerProxyRoutesDependencies): Router {
  const router = Router();

  /**
   * Build the full Caseworker API URL
   * @param subdomainOrCustom - Either a subdomain for farier.com or "custom"
   * @param path - The API path (e.g., /auth, /cases/search)
   * @param customDomain - Full custom domain (used when subdomainOrCustom is "custom")
   */
  function buildApiUrl(subdomainOrCustom: string, path: string, customDomain?: string): string {
    // If using custom domain mode
    if (subdomainOrCustom === 'custom' && customDomain) {
      const cleanDomain = customDomain
        .replace(/^https?:\/\//, '')
        .replace(/\/$/, '');
      return `https://${cleanDomain}/api/ajax${path}`;
    }

    // Default: subdomain of farier.com
    const cleanSubdomain = subdomainOrCustom
      .replace(/^https?:\/\//, '')
      .replace(/\.farier\.com.*$/, '')
      .replace(/\/$/, '');
    return `https://${cleanSubdomain}.farier.com/api/ajax${path}`;
  }

  /**
   * Forward a request to the Caseworker API
   */
  async function proxyRequest(
    req: Request,
    res: Response,
    subdomain: string,
    path: string,
    options: {
      method: string;
      body?: unknown;
      authToken?: string;
      customDomain?: string;
    }
  ): Promise<void> {
    const url = buildApiUrl(subdomain, path, options.customDomain);

    console.log(`[CaseworkerProxy] ${options.method} ${url}`);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (options.authToken) {
      headers['Authorization'] = options.authToken;
    }

    const fetchOptions: RequestInit = {
      method: options.method,
      headers,
    };

    if (options.body) {
      fetchOptions.body = JSON.stringify(options.body);
    }

    try {
      const response = await fetch(url, fetchOptions);
      const contentType = response.headers.get('content-type');

      // Get response body
      let responseBody: string;
      if (contentType?.includes('application/json')) {
        responseBody = await response.text();
      } else {
        responseBody = await response.text();
      }

      // Forward status code and response
      res.status(response.status);

      // Copy relevant headers
      const corsHeaders = ['content-type', 'etag', 'cache-control'];
      corsHeaders.forEach(header => {
        const value = response.headers.get(header);
        if (value) {
          res.setHeader(header, value);
        }
      });

      res.send(responseBody);
    } catch (error) {
      console.error(`[CaseworkerProxy] Error:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      const apiResponse: ApiResponse = {
        success: false,
        error: {
          code: 'PROXY_ERROR',
          message: `Failed to proxy request: ${errorMessage}`,
        },
      };

      res.status(502).json(apiResponse);
    }
  }

  /**
   * POST /:subdomain/auth
   * Authenticate with the Caseworker API
   */
  router.post('/:subdomain/auth', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { subdomain } = req.params;
      const { email, password, otp, locale } = req.body;

      if (!email || !password) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Email and password are required',
          },
        };
        return res.status(400).json(response);
      }

      await proxyRequest(req, res, subdomain, '/auth', {
        method: 'POST',
        body: {
          email,
          password,
          otp,
          locale: locale || 'en-GB',
        },
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /:subdomain/cases/search
   * Search for cases
   */
  router.post('/:subdomain/cases/search', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { subdomain } = req.params;
      const authToken = req.headers.authorization as string | undefined;

      if (!authToken) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authorization header is required',
          },
        };
        return res.status(401).json(response);
      }

      await proxyRequest(req, res, subdomain, '/cases/search', {
        method: 'POST',
        body: req.body,
        authToken,
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /:subdomain/cases/:id
   * Get a specific case
   */
  router.get('/:subdomain/cases/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { subdomain, id } = req.params;
      const authToken = req.headers.authorization as string | undefined;

      if (!authToken) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authorization header is required',
          },
        };
        return res.status(401).json(response);
      }

      await proxyRequest(req, res, subdomain, `/cases/${id}`, {
        method: 'GET',
        authToken,
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * PATCH /:subdomain/cases/:id
   * Update a specific case
   */
  router.patch('/:subdomain/cases/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { subdomain, id } = req.params;
      const authToken = req.headers.authorization as string | undefined;

      if (!authToken) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authorization header is required',
          },
        };
        return res.status(401).json(response);
      }

      await proxyRequest(req, res, subdomain, `/cases/${id}`, {
        method: 'PATCH',
        body: req.body,
        authToken,
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Catch-all: Forward any other requests
   * This allows the proxy to work with any endpoint
   *
   * For custom domains, use "custom" as subdomain with ?domain=yourdomain.com
   * Example: /api/caseworker-proxy/custom/api/ajax/auth?domain=aballinger.caseworkermp.com
   */
  router.all('/:subdomain/*', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { subdomain } = req.params;
      // Get the path after the subdomain
      const path = '/' + req.params[0];
      const authToken = req.headers.authorization as string | undefined;
      // Support custom domain via query parameter
      const customDomain = req.query.domain as string | undefined;

      await proxyRequest(req, res, subdomain, path, {
        method: req.method,
        body: ['POST', 'PUT', 'PATCH'].includes(req.method) ? req.body : undefined,
        authToken,
        customDomain,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
