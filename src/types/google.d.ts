declare namespace google {
  namespace accounts {
    namespace oauth2 {
      interface TokenClient {
        requestAccessToken(options?: { prompt?: string }): void;
      }

      interface TokenResponse {
        access_token: string;
        expires_in: number;
        error?: string;
        error_description?: string;
      }

      function initTokenClient(config: {
        client_id: string;
        scope: string;
        callback: (response: TokenResponse) => void;
      }): TokenClient;

      function revoke(token: string, callback?: () => void): void;
    }
  }
}

declare namespace gapi {
  function load(api: string, callback: () => void): void;

  namespace client {
    function init(config: { discoveryDocs?: string[] }): Promise<void>;
    function getToken(): { access_token: string } | null;
    function setToken(token: { access_token: string } | null): void;

    namespace calendar {
      namespace events {
        function list(params: {
          calendarId: string;
          timeMin?: string;
          timeMax?: string;
          showDeleted?: boolean;
          singleEvents?: boolean;
          orderBy?: string;
          maxResults?: number;
        }): Promise<{
          result: {
            items?: Event[];
          };
        }>;
      }

      interface Event {
        id?: string;
        summary?: string;
        description?: string;
        start?: {
          dateTime?: string;
          date?: string;
        };
        end?: {
          dateTime?: string;
          date?: string;
        };
        attendees?: EventAttendee[];
        htmlLink?: string;
      }

      interface EventAttendee {
        email?: string;
        displayName?: string;
        responseStatus?: string;
      }
    }
  }
}
